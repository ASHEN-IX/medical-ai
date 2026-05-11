from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.knowledge_graph.kg_schema import KnowledgeGraphContext
from app.models.gateway_schema import GatewayAnalyzeRequest
from app.models.llm_schema import LLMExplanationResponse
from app.models.session_schema import (
    DiagnosisSession,
    FetchQuestionsResponse,
    FinalReportResponse,
    FollowUpQuestion,
    InitialAnalysisResponse,
    PatientAnswer,
    SessionStage,
    SubmitAnswersResponse,
)
from app.services.answer_enrichment import AnswerEnrichmentService
from app.services.gateway_service import GatewayService
from app.services.kg_client import KGClient, KGClientError
from app.services.llm_service import LLMService, LLMServiceError
from app.services.question_generator import QuestionGenerator
from app.services.rag_client import RAGClient, RAGClientError
from app.services.session_store import SessionStore, diagnosis_session_store
from app.utils.risk_aggregator import aggregate_overall_risk, normalize_risk

logger = logging.getLogger(__name__)

FOLLOW_UP_RISK_THRESHOLD = "MEDIUM"
ALLOWED_REPORT_TYPES = {"auto", "diabetes", "heart", "kidney", "stroke", "autism", "mixed"}


class StagedDiagnosisError(RuntimeError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class StagedDiagnosisService:
    def __init__(
        self,
        gateway_service: GatewayService | None = None,
        question_generator: QuestionGenerator | None = None,
        enrichment_service: AnswerEnrichmentService | None = None,
        llm_service: LLMService | None = None,
        rag_client: RAGClient | None = None,
        kg_client: KGClient | None = None,
        session_store: SessionStore | None = None,
    ) -> None:
        self.gateway = gateway_service or GatewayService()
        self.question_generator = question_generator or QuestionGenerator()
        self.enrichment = enrichment_service or AnswerEnrichmentService()
        self.llm_service = llm_service or LLMService()
        self.rag_client = rag_client or RAGClient()
        self.kg_client = kg_client or KGClient()
        self.store = session_store or diagnosis_session_store

    # ------------------------------------------------------------------
    # Phase 1: initial upload + analysis + question generation
    # ------------------------------------------------------------------

    async def run_initial_analysis(
        self,
        report_type: str,
        features: Dict[str, Any],
        raw_text: Optional[str],
        symptoms: List[str],
        include_explanation: bool,
        image: Optional[str],
        request_id: str,
    ) -> InitialAnalysisResponse:
        needs_follow_up = False
        started = time.perf_counter()
        session_id = f"sess_{uuid4().hex[:16]}"
        normalized_report_type = self._normalize_report_type(report_type)

        gateway_request = GatewayAnalyzeRequest(
            report_type=normalized_report_type,
            features={k: v for k, v in features.items() if isinstance(v, (int, float, str, bool))},
            raw_text=raw_text,
            include_explanation=include_explanation,
            symptoms=symptoms,
            image=image,
        )

        gateway_response = await self.gateway.analyze(gateway_request, request_id=request_id)

        overall_risk = gateway_response.risk_assessment.overall_risk
        selected_disease = self._pick_top_disease(gateway_response.model_outputs, gateway_response.selected_models)
        max_confidence = self._max_confidence(gateway_response.results)

        is_autism = any(m in gateway_response.selected_models for m in ("autism_pred", "autism_dl"))
        autism_detected = False
        if is_autism:
            for m in ("autism_pred", "autism_dl"):
                detail = gateway_response.model_outputs.get(m)
                if detail and detail.raw_response:
                    pred = detail.raw_response.get("prediction", {})
                    if pred.get("autism_detected"):
                        autism_detected = True
                        break
        needs_follow_up = self._should_follow_up(overall_risk, max_confidence)

        questions: List[FollowUpQuestion] = []

        if needs_follow_up and selected_disease:
            questions = await self.question_generator.generate_questions(
                predicted_disease=selected_disease,
                confidence=max_confidence,
                overall_risk=overall_risk,
                features=features,
                symptoms=symptoms,
                model_outputs=dict(gateway_response.model_outputs),
            )

        stage = SessionStage.FOLLOW_UP_PENDING if questions else SessionStage.INITIAL_ANALYSIS

        session = DiagnosisSession(
            session_id=session_id,
            stage=stage,
            report_type=gateway_response.inputs.report_type,
            initial_prediction={
                "model_outputs": {k: v.model_dump() for k, v in gateway_response.model_outputs.items()},
                "results": {k: v.model_dump() for k, v in gateway_response.results.items()},
                "risk_assessment": gateway_response.risk_assessment.model_dump(),
                "reasoning": gateway_response.reasoning,
            },
            selected_disease=selected_disease,
            overall_risk=overall_risk,
            confidence=max_confidence,
            features=features,
            raw_text=raw_text,
            follow_up_questions=questions,
        )
        self.store.put(session)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "Staged diagnosis phase-1 session_id=%s disease=%s risk=%s follow_up=%s questions=%s duration_ms=%s",
            session_id, selected_disease, overall_risk, needs_follow_up, len(questions), duration_ms,
        )

        return InitialAnalysisResponse(
            session_id=session_id,
            stage=stage,
            report_type=gateway_response.inputs.report_type,
            selected_disease=selected_disease,
            overall_risk=overall_risk,
            confidence=max_confidence,
            model_outputs={k: v.model_dump() for k, v in gateway_response.model_outputs.items()},
            needs_follow_up=bool(questions),
            follow_up_questions=questions,
            reasoning=gateway_response.reasoning,
            rag_context=gateway_response.rag_context,
            kg_insights=gateway_response.kg_insights.model_dump(),
            metadata={"processing_time_ms": duration_ms, "request_id": request_id},
        )

    # ------------------------------------------------------------------
    # Fetch questions for a session
    # ------------------------------------------------------------------

    async def fetch_questions(self, session_id: str) -> FetchQuestionsResponse:
        session = self._get_session(session_id)
        return FetchQuestionsResponse(
            session_id=session_id,
            stage=session.stage,
            selected_disease=session.selected_disease,
            questions=session.follow_up_questions,
            question_count=len(session.follow_up_questions),
        )

    # ------------------------------------------------------------------
    # Phase 2a: accept answers + enrich features
    # ------------------------------------------------------------------

    async def submit_answers(self, session_id: str, answers: List[PatientAnswer]) -> SubmitAnswersResponse:
        session = self._get_session(session_id)

        if session.stage not in (SessionStage.FOLLOW_UP_PENDING, SessionStage.ANSWERS_SUBMITTED):
            raise StagedDiagnosisError(
                f"Session {session_id} is not in a state that accepts answers (current: {session.stage})",
                status_code=409,
            )

        if not answers:
            raise StagedDiagnosisError("No answers provided", status_code=400)

        valid_qids = {q.id for q in session.follow_up_questions}
        for ans in answers:
            if ans.question_id not in valid_qids:
                raise StagedDiagnosisError(
                    f"Answer references unknown question_id={ans.question_id}",
                    status_code=400,
                )

        enriched = self.enrichment.enrich(session.follow_up_questions, answers)

        session.answers.extend(answers)
        session.enriched_features.update(enriched)

        merged_features = dict(session.features)
        merged_features.update(session.enriched_features)

        next_questions: List[FollowUpQuestion] = []
        if session.selected_disease:
            generated = await self.question_generator.generate_questions(
                predicted_disease=session.selected_disease,
                confidence=session.confidence,
                overall_risk=session.overall_risk,
                features=merged_features,
                symptoms=[],
                model_outputs=session.initial_prediction.get("model_outputs", {}),
            )
            seen_texts = {q.text.strip().lower() for q in session.follow_up_questions}
            next_questions = [q for q in generated if q.text.strip().lower() not in seen_texts]

        if next_questions:
            session.follow_up_questions.extend(next_questions)
            session.stage = SessionStage.FOLLOW_UP_PENDING
        else:
            session.stage = SessionStage.ANSWERS_SUBMITTED

        session.updated_at = datetime.now(timezone.utc)
        self.store.put(session)

        logger.info(
            "Answers submitted session_id=%s answer_count=%s enriched_feature_count=%s",
            session_id, len(answers), len(enriched),
        )

        return SubmitAnswersResponse(
            session_id=session_id,
            stage=session.stage,
            enriched_features=session.enriched_features,
            feature_count=len(session.enriched_features),
            next_questions=next_questions,
            needs_more_questions=bool(next_questions),
        )

    # ------------------------------------------------------------------
    # Phase 2b: second-stage diagnosis + final report
    # ------------------------------------------------------------------

    async def generate_final_report(self, session_id: str, request_id: str) -> FinalReportResponse:
        started = time.perf_counter()
        session = self._get_session(session_id)

        if session.stage != SessionStage.ANSWERS_SUBMITTED:
            raise StagedDiagnosisError(
                f"Session {session_id} is not ready for final report (current: {session.stage})",
                status_code=409,
            )

        merged_features = dict(session.features)
        merged_features.update(session.enriched_features)

        symptoms_from_answers = [
            k.replace("symptom_", "").replace("_", " ")
            for k, v in session.enriched_features.items()
            if k.startswith("symptom_") and v == 1.0
        ]

        gateway_request = GatewayAnalyzeRequest(
            report_type=session.report_type,
            features={k: v for k, v in merged_features.items() if isinstance(v, (int, float))},
            raw_text=session.raw_text,
            include_explanation=True,
            symptoms=symptoms_from_answers,
        )

        second_pass = await self.gateway.analyze(gateway_request, request_id=f"{request_id}_p2")

        updated_risk = second_pass.risk_assessment.overall_risk
        updated_confidence = self._max_confidence(second_pass.results)
        rag_context = self._unique_texts(list(second_pass.rag_context))

        evidence = self._build_evidence_summary(session, second_pass, merged_features)
        caveats = self._build_caveats(session, second_pass)
        recs = self._extract_recommendations(second_pass)

        initial_risk = session.overall_risk
        initial_confidence = session.confidence

        narrative = ""
        try:
            narrative = await self._generate_narrative(
                session=session,
                second_pass=second_pass,
                evidence=evidence,
                merged_features=merged_features,
            )
        except Exception as exc:
            logger.warning("Narrative generation failed session_id=%s error=%s", session_id, exc)

        session.stage = SessionStage.FINAL_REPORT_READY
        session.final_report = {
            "updated_risk": updated_risk,
            "updated_confidence": updated_confidence,
            "rag_context": rag_context,
            "kg_insights": second_pass.kg_insights.model_dump(),
            "evidence": evidence,
            "caveats": caveats,
            "recommendations": recs,
            "narrative": narrative,
        }
        session.updated_at = datetime.now(timezone.utc)
        self.store.put(session)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "Final report generated session_id=%s risk=%s->%s confidence=%.2f->%.2f duration_ms=%s",
            session_id, initial_risk, updated_risk, initial_confidence, updated_confidence, duration_ms,
        )

        return FinalReportResponse(
            session_id=session_id,
            report_type=session.report_type,
            selected_disease=session.selected_disease,
            updated_risk=updated_risk,
            updated_confidence=updated_confidence,
            model_outputs={k: v.model_dump() for k, v in second_pass.model_outputs.items()},
            rag_context=rag_context,
            kg_insights=second_pass.kg_insights.model_dump(),
            evidence_summary=evidence,
            missing_caveats=caveats,
            recommendations=recs,
            llm_narrative=narrative,
            initial_vs_final={
                "initial_risk": initial_risk,
                "final_risk": updated_risk,
                "initial_confidence": round(initial_confidence, 3),
                "final_confidence": round(updated_confidence, 3),
                "risk_changed": initial_risk != updated_risk,
                "confidence_delta": round(updated_confidence - initial_confidence, 3),
            },
            metadata={"processing_time_ms": duration_ms, "request_id": request_id},
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_session(self, session_id: str) -> DiagnosisSession:
        session = self.store.get(session_id)
        if session is None:
            raise StagedDiagnosisError(f"Session {session_id} not found or expired", status_code=404)
        return session

    def _normalize_report_type(self, report_type: Optional[str]) -> str:
        if not report_type:
            return "auto"

        normalized = report_type.strip().lower()
        if normalized == "general":
            return "auto"

        if normalized in ALLOWED_REPORT_TYPES:
            return normalized

        logger.warning(
            "Unsupported report_type=%s for staged diagnosis; falling back to auto",
            report_type,
        )
        return "auto"

    def _should_follow_up(self, overall_risk: str, confidence: float) -> bool:
        risk = overall_risk.strip().upper()
        # In binary mode, any HIGH risk triggers follow-up
        if risk == "HIGH":
            return True
        return False

    def _pick_top_disease(
        self,
        model_outputs: Dict[str, Any],
        selected_models: List[str],
    ) -> Optional[str]:
        best_model = None
        best_confidence = -1.0

        for model_name in selected_models:
            detail = model_outputs.get(model_name)
            if detail is None:
                continue
            conf = getattr(detail, "confidence", 0.0) if hasattr(detail, "confidence") else 0.0
            risk = getattr(detail, "risk", "LOW") if hasattr(detail, "risk") else "LOW"
            if risk == "HIGH" and conf > best_confidence:
                best_confidence = conf
                best_model = model_name

        if best_model is None:
            for model_name in selected_models:
                detail = model_outputs.get(model_name)
                if detail is None:
                    continue
                conf = getattr(detail, "confidence", 0.0) if hasattr(detail, "confidence") else 0.0
                if conf > best_confidence:
                    best_confidence = conf
                    best_model = model_name

        return best_model

    def _max_confidence(self, results: Dict[str, Any]) -> float:
        max_conf = 0.0
        for v in results.values():
            conf = getattr(v, "confidence", 0.0) if hasattr(v, "confidence") else 0.0
            if conf > max_conf:
                max_conf = conf
        return max_conf

    def _unique_texts(self, items: List[str]) -> List[str]:
        unique: List[str] = []
        seen: set[str] = set()
        for item in items:
            cleaned = item.strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            unique.append(cleaned)
        return unique

    def _build_evidence_summary(self, session: DiagnosisSession, second_pass: Any, merged: Dict[str, Any]) -> List[str]:
        evidence: List[str] = []

        answer_count = len(session.answers)
        if answer_count:
            evidence.append(f"Patient provided {answer_count} follow-up answers")

        enriched_symptoms = [
            k.replace("symptom_", "").replace("_", " ")
            for k, v in session.enriched_features.items()
            if k.startswith("symptom_") and v == 1.0
        ]
        if enriched_symptoms:
            evidence.append(f"Confirmed symptoms: {', '.join(enriched_symptoms)}")

        lifestyle_keys = [k for k in session.enriched_features if k.startswith("lifestyle_") or k.startswith("risk_")]
        if lifestyle_keys:
            evidence.append(f"Lifestyle/risk factors assessed: {', '.join(k.replace('_', ' ') for k in lifestyle_keys)}")

        if second_pass.rag_context:
            evidence.append(f"RAG context: {len(second_pass.rag_context)} relevant clinical passages retrieved")

        if second_pass.kg_insights and second_pass.kg_insights.diseases:
            evidence.append(f"Knowledge graph diseases: {', '.join(second_pass.kg_insights.diseases)}")

        for model_name, detail in second_pass.model_outputs.items():
            risk = getattr(detail, "risk", "LOW") if hasattr(detail, "risk") else "LOW"
            conf = getattr(detail, "confidence", 0.0) if hasattr(detail, "confidence") else 0.0
            evidence.append(f"{model_name} model: {risk} risk ({conf*100:.0f}% confidence)")

        return evidence

    def _build_caveats(self, session: DiagnosisSession, second_pass: Any) -> List[str]:
        caveats: List[str] = []

        unanswered = set(q.id for q in session.follow_up_questions) - set(a.question_id for a in session.answers)
        if unanswered:
            caveats.append(f"{len(unanswered)} follow-up question(s) were not answered")

        initial_risk = session.overall_risk
        final_risk = second_pass.risk_assessment.overall_risk
        if initial_risk == "HIGH" and final_risk != "HIGH":
            caveats.append(
                f"Initial analysis indicated HIGH risk, but second-pass analysis adjusted to {final_risk}. "
                "Clinical confirmation is recommended."
            )

        if self._max_confidence(second_pass.results) < 0.5:
            caveats.append("Model confidence is below 50% — results should be interpreted with extra caution")

        return caveats

    def _extract_recommendations(self, second_pass: Any) -> List[str]:
        recs: List[str] = []
        if second_pass.llm_explanation and hasattr(second_pass.llm_explanation, "recommendations"):
            recs.extend(second_pass.llm_explanation.recommendations)
        if not recs:
            recs.append("Consult a healthcare professional to discuss these findings")
        return recs

    async def _generate_narrative(
        self,
        session: DiagnosisSession,
        second_pass: Any,
        evidence: List[str],
        merged_features: Dict[str, Any],
    ) -> str:
        rag_context = list(second_pass.rag_context) if second_pass.rag_context else []

        kg_context = None
        try:
            if session.selected_disease:
                kg_context = await asyncio.to_thread(
                    self.kg_client.get_context_for_models, [session.selected_disease]
                )
        except Exception:
            pass

        model_results = {k: v.model_dump() for k, v in second_pass.model_outputs.items()}

        try:
            payload = await self.llm_service.generate_explanation(
                model_results=model_results,
                features={k: v for k, v in merged_features.items() if isinstance(v, (int, float, str))},
                rag_context=rag_context,
                kg_context=kg_context,
                request_id=session.session_id,
            )
            return payload.get("summary", "")
        except LLMServiceError:
            return ""
