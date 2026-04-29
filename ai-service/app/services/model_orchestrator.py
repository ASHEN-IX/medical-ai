from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from app.services.model_client import ModelClient, ModelPrediction


logger = logging.getLogger(__name__)


@dataclass
class OrchestrationResult:
    results: dict[str, dict[str, str | float]] = field(default_factory=dict)
    failures: dict[str, str] = field(default_factory=dict)
    fallback_models: list[str] = field(default_factory=list)
    details: dict[str, ModelPrediction] = field(default_factory=dict)


class ModelOrchestrator:
    """Executes multiple model predictions in parallel and normalizes outputs."""

    def __init__(self, model_client: ModelClient | None = None) -> None:
        self.model_client = model_client or ModelClient()

    async def execute(
        self,
        selected_models: Sequence[str],
        features: Mapping[str, Any],
        request_id: str,
        symptoms: Sequence[str] | None = None,
        image_base64: str | None = None,
    ) -> OrchestrationResult:
        orchestrated = OrchestrationResult()

        tasks: dict[str, asyncio.Task[ModelPrediction]] = {}
        for model_name in selected_models:
            if model_name == "diabetes":
                tasks[model_name] = asyncio.create_task(self.model_client.predict_diabetes(features, request_id))
            elif model_name == "heart":
                tasks[model_name] = asyncio.create_task(self.model_client.predict_heart(features, request_id))
            elif model_name == "kidney":
                tasks[model_name] = asyncio.create_task(self.model_client.predict_kidney(features, request_id))
            elif model_name == "stroke":
                tasks[model_name] = asyncio.create_task(
                    self.model_client.predict_stroke(features, request_id, symptoms=symptoms)
                )
            elif model_name == "autism_dl":
                if not image_base64:
                    orchestrated.failures[model_name] = "Image input is required for autism_dl"
                    continue
                tasks[model_name] = asyncio.create_task(
                    self.model_client.predict_autism_dl(image_base64, request_id)
                )
            elif model_name == "autism_pred":
                # autism_pred requires the survey responses + demographics in features
                tasks[model_name] = asyncio.create_task(self.model_client.predict_autism_pred(features, request_id))
            else:
                orchestrated.failures[model_name] = "Unsupported model requested"

        if not tasks:
            return orchestrated

        task_results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        for model_name, outcome in zip(tasks.keys(), task_results):
            if isinstance(outcome, Exception):
                logger.exception("Model orchestration failed for model=%s", model_name, exc_info=outcome)
                orchestrated.failures[model_name] = str(outcome)
                continue

            if not outcome.success:
                orchestrated.failures[model_name] = outcome.error or "Model call failed"
                continue

            orchestrated.details[model_name] = outcome
            orchestrated.results[model_name] = {
                "risk": outcome.risk,
                "confidence": round(outcome.confidence, 2),
            }

            if outcome.source != "endpoint":
                orchestrated.fallback_models.append(model_name)
                if outcome.error:
                    orchestrated.failures.setdefault(model_name, outcome.error)

        return orchestrated
