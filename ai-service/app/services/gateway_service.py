from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Mapping

from app.models.gateway_schema import (
    FinalAssessment,
    GatewayAnalyzeRequest,
    GatewayAnalyzeResponse,
    GatewayMetadata,
)
from app.services.model_orchestrator import ModelOrchestrator
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
    ) -> None:
        self.routing_engine = routing_engine or RoutingEngine()
        self.model_orchestrator = model_orchestrator or ModelOrchestrator()

    async def analyze(self, payload: GatewayAnalyzeRequest, request_id: str) -> GatewayAnalyzeResponse:
        started = time.perf_counter()
        features = self._normalize_features(payload.features)

        self._validate_payload(payload, features)

        selected_models = self.routing_engine.route(
            report_type=payload.report_type,
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
            payload.report_type,
        )

        orchestration_result = await self.model_orchestrator.execute(
            selected_models=selected_models,
            features=features,
            request_id=request_id,
            symptoms=payload.symptoms,
            image_base64=payload.image,
        )

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
            results=orchestration_result.results,
            final_assessment=FinalAssessment(overall_risk=overall_risk, priority=priority),
            reasoning=reasoning,
            metadata=GatewayMetadata(
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
        )

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


def llm_reasoning(features: dict[str, Any], results: dict[str, dict[str, Any]]) -> None:
    """Sprint 6 placeholder for LLM-powered explanation and clinical insight generation."""
    pass
