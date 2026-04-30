from __future__ import annotations

import asyncio
import logging
import time
import re
import re
from datetime import datetime, timezone
from typing import Any, Mapping

from app.knowledge_graph.kg_schema import KnowledgeGraphContext
from app.knowledge_graph.kg_schema import KnowledgeGraphContext
from app.models.gateway_schema import (
    FinalAssessment,
    GatewayAnalyzeRequest,
    GatewayAnalyzeResponse,
    GatewayMetadata,
)
from app.models.llm_schema import LLMExplanationResponse
from app.services.analysis_aggregator import AnalysisResponseAggregator
from app.services.kg_client import KGClient, KGClientError
from app.services.llm_service import LLMService, LLMServiceError
from app.services.medical_rag_service import MedicalRagServiceError
from app.services.nlp_service import NLPService
from app.services.autism_parser import parse_autism_prediction_request
from app.services.model_orchestrator import ModelOrchestrator
from app.services.rag_client import RAGClient, RAGClientError
from app.services.routing_engine import RoutingEngine
from app.utils.risk_aggregator import aggregate_overall_risk, build_reasoning, priority_from_risk


logger = logging.getLogger(__name__)


class GatewayValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class GatewayService:
    """Central AI gateway orchestrator for routing, prediction, and decision aggregation."""

    def __init__(
        self,
        routing_engine: RoutingEngine | None = None,
        model_orchestrator: ModelOrchestrator | None = None,
        llm_service: LLMService | None = None,
        rag_client: RAGClient | None = None,
        kg_client: KGClient | None = None,
        nlp_service: NLPService | None = None,
        response_aggregator: AnalysisResponseAggregator | None = None,
    ) -> None:
        self.routing_engine = routing_engine or RoutingEngine()
        self.model_orchestrator = model_orchestrator or ModelOrchestrator()
        self.llm_service = llm_service or LLMService()
        self.rag_client = rag_client or RAGClient()
        self.kg_client = kg_client or KGClient()
        self.nlp_service = nlp_service or NLPService()
        self.response_aggregator = response_aggregator or AnalysisResponseAggregator()

    async def analyze(self, payload: GatewayAnalyzeRequest, request_id: str) -> GatewayAnalyzeResponse:
        started = time.perf_counter()
        features = self._normalize_features(payload.features)
        raw_text = getattr(payload, "raw_text", None)
        extracted_report_type = str(payload.report_type)

        if raw_text:
            nlp_result = await asyncio.to_thread(self.nlp_service.process_text, raw_text)
            extracted_report_type = nlp_result.report_type if nlp_result.report_type != "general" else extracted_report_type
            extracted_features = self._normalize_features(nlp_result.features)
            merged_features = dict(extracted_features)
            merged_features.update(features)
            features = merged_features

            try:
                if self._looks_like_autism_screening(raw_text) or extracted_report_type == "autism":
                    parsed = parse_autism_prediction_request(raw_text)
                    # attach structured survey + demographics so ModelClient can post the expected payload
                    features["responses"] = parsed.responses.model_dump() if hasattr(parsed.responses, "model_dump") else parsed.responses.dict()
                    features["demographics"] = parsed.demographics.model_dump() if hasattr(parsed.demographics, "model_dump") else parsed.demographics.dict()
                    extracted_report_type = "autism"
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Autism parser failed request_id=%s error=%s", request_id, exc)

        self._validate_payload(payload, features)

        selected_models = self.routing_engine.route(
            report_type=extracted_report_type,
            features=features,
            symptoms=payload.symptoms,
            has_image=bool(payload.image),
        )
        if not selected_models:
            raise GatewayValidationError(
                "No target models were selected from the provided features",
                status_code=400,
            )

        logger.info(
            "AI gateway request_id=%s selected_models=%s report_type=%s",
            request_id,
            selected_models,
            extracted_report_type,
        )

        model_task = asyncio.create_task(
            self.model_orchestrator.execute(
                selected_models=selected_models,
                features=features,
                request_id=request_id,
                symptoms=payload.symptoms,
                image_base64=payload.image,
            )
        )
        rag_task = asyncio.create_task(
            self._build_rag_context(
                report_type=extracted_report_type,
                features=features,
                symptoms=payload.symptoms,
                selected_models=selected_models,
                request_id=request_id,
            )
        )
        kg_task = asyncio.create_task(self._build_kg_context(selected_models, request_id=request_id))

        model_outcome, rag_outcome, kg_outcome = await asyncio.gather(
            model_task,
            rag_task,
            kg_task,
            return_exceptions=True,
        )

        orchestration_result = model_outcome
        if isinstance(orchestration_result, Exception):
            logger.warning("Model orchestration failed request_id=%s error=%s", request_id, orchestration_result)
            orchestration_result = await self.model_orchestrator.execute(
                selected_models=selected_models,
                features=features,
                request_id=request_id,
                symptoms=payload.symptoms,
                image_base64=payload.image,
            )

        rag_context = []
        if isinstance(rag_outcome, Exception):
            logger.warning("RAG context unavailable request_id=%s error=%s", request_id, rag_outcome)
        else:
            rag_context = list(rag_outcome)

        kg_context = KnowledgeGraphContext()
        if isinstance(kg_outcome, Exception):
            logger.warning("Knowledge graph context unavailable request_id=%s error=%s", request_id, kg_outcome)
        else:
            kg_context = kg_outcome

        overall_risk = aggregate_overall_risk(orchestration_result.results)
        priority = priority_from_risk(overall_risk)

        reasoning = build_reasoning(
            features=features,
            results=orchestration_result.results,
            selected_models=selected_models,
            symptoms=payload.symptoms,
            failures=orchestration_result.failures,
            fallback_models=orchestration_result.fallback_models,
        )
        if not payload.include_explanation:
            reasoning = []

        llm_explanation: LLMExplanationResponse | None = None
        if payload.include_explanation:
            try:
                llm_payload = await self.llm_service.generate_explanation(
                    model_results=orchestration_result.results,
                    features=features,
                    rag_context=rag_context,
                    kg_context=kg_context,
                    request_id=request_id,
                )
                llm_explanation = LLMExplanationResponse.model_validate(llm_payload)
            except LLMServiceError as exc:
                logger.warning("LLM explanation skipped request_id=%s error=%s", request_id, exc)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "AI gateway completed request_id=%s overall_risk=%s priority=%s duration_ms=%s failures=%s",
            request_id,
            overall_risk,
            priority,
            duration_ms,
            list(orchestration_result.failures.keys()),
        )

        return GatewayAnalyzeResponse(
            success=True,
            selected_models=selected_models,
            orchestration_result=orchestration_result,
            rag_context=rag_context,
            kg_context=kg_context,
            llm_explanation=llm_explanation,
            metadata=metadata,
            reasoning=reasoning,
            include_explanation=payload.include_explanation,
            symptoms=list(payload.symptoms),
            has_image=bool(payload.image),
            has_raw_text=bool(raw_text),
        )

    async def _build_rag_context(
        self,
        report_type: str,
        features: Mapping[str, Any],
        symptoms: list[str],
        selected_models: list[str],
        request_id: str,
    ) -> list[str]:
        rag_query = self._build_rag_query(report_type, features, symptoms, selected_models)

        try:
            return await asyncio.to_thread(self.rag_client.retrieve_context, rag_query, 3)
        except RAGClientError as exc:
            logger.warning("RAG context unavailable request_id=%s error=%s", request_id, exc)
            return []
<<<<<<< HEAD
            hits = await asyncio.to_thread(medical_rag_service.retrieve, rag_query, 3)
=======
            return await asyncio.to_thread(self.rag_client.retrieve_context, rag_query, 3)
        except RAGClientError as exc:
            logger.warning("RAG context unavailable request_id=%s error=%s", request_id, exc)
            return []
>>>>>>> d223790fad2d1269a97172fb2fad90d750636712
        except MedicalRagServiceError as exc:
            logger.warning("RAG context unavailable request_id=%s error=%s", request_id, exc)
            return []

    async def _build_kg_context(self, selected_models: list[str], request_id: str) -> KnowledgeGraphContext:
        try:
            return await asyncio.to_thread(self.kg_client.get_context_for_models, selected_models)
        except KGClientError as exc:
            logger.warning("Knowledge graph context unavailable request_id=%s error=%s", request_id, exc)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Knowledge graph context failed request_id=%s error=%s", request_id, exc)

        return KnowledgeGraphContext()

    def _validate_payload(self, payload: GatewayAnalyzeRequest, features: Mapping[str, Any]) -> None:
        if not features and not payload.image and not payload.symptoms:
            raise GatewayValidationError(
                "Missing features: provide clinical features, symptoms, or image input",
                status_code=400,
            )

    def _normalize_features(self, features: Mapping[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key, value in features.items():
            if isinstance(value, (int, float)):
                normalized[key] = float(value)
                continue

            if isinstance(value, str):
                stripped = value.strip()
                try:
                    normalized[key] = float(stripped)
                    continue
                except ValueError:
                    normalized[key] = stripped
                    continue

            normalized[key] = value

        return normalized

    def _build_rag_query(
        self,
        report_type: str,
        features: Mapping[str, Any],
        symptoms: list[str],
        selected_models: list[str],
    ) -> str:
        feature_terms = []
        for key, value in list(features.items())[:10]:
            feature_terms.append(f"{key} {value}")

        symptom_terms = ", ".join(symptoms[:8]) if symptoms else ""
        model_terms = ", ".join(selected_models[:6]) if selected_models else ""

        parts = [report_type, model_terms, symptom_terms, " ".join(feature_terms)]
        return " ".join(part for part in parts if part).strip() or "medical explanation"

    def _looks_like_autism_screening(self, raw_text: str) -> bool:
        text = raw_text.lower()
        if any(keyword in text for keyword in {"m-chat", "autism spectrum", "autism screening", "screening responses"}):
            return True

        has_questionnaire_span = bool(re.search(r"\bA1\b.*\bA10\b", raw_text, re.IGNORECASE | re.DOTALL))
        has_item_markers = len(re.findall(r"\bA(?:[1-9]|10)\b", raw_text, re.IGNORECASE)) >= 5
        return has_questionnaire_span and has_item_markers


def llm_reasoning(features: dict[str, Any], results: dict[str, dict[str, Any]]) -> None:
    """Sprint 6 placeholder for LLM-powered explanation and clinical insight generation."""
    pass
