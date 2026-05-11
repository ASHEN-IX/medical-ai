from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    Metadata,
    ThyroidClassProbabilities,
    ThyroidPredictionResult,
    ThyroidRequest,
    ThyroidResponse,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class ThyroidService:
    def _risk_level(self, recurrence_detected: bool) -> str:
        return "HIGH" if recurrence_detected else "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Endocrinology follow-up is strongly recommended",
                "Review post-treatment thyroid markers and imaging",
                "Consider accelerated monitoring schedule",
            ]
        return [
            "Current recurrence risk appears low",
            "Continue routine monitoring and follow-up care",
            "Reassess if symptoms or biomarkers change",
        ]

    def _to_float(self, value: Any) -> float:
        if isinstance(value, bool):
            return 1.0 if value else 0.0
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def _build_feature_frame(self, payload: ThyroidRequest, model: Any) -> pd.DataFrame:
        payload_data = payload.model_dump(exclude_none=True)
        feature_payload = payload_data.get("features", payload_data)

        if not isinstance(feature_payload, dict):
            feature_payload = {}

        expected_columns = [str(col) for col in getattr(model, "feature_names_in_", [])]
        if not expected_columns:
            expected_columns = sorted(feature_payload.keys())

        # Case-insensitive mapping
        feature_lower = {str(k).lower(): v for k, v in feature_payload.items()}
        normalized = {column: self._to_float(feature_lower.get(column.lower())) for column in expected_columns}
        return pd.DataFrame([normalized], columns=expected_columns)

    def _is_positive_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "true", "yes", "positive", "recurrence", "recurrent", "high"}

    def predict(self, payload: ThyroidRequest, request_id: str) -> ThyroidResponse:
        started = time.perf_counter()
        model = model_loader.thyroid_model
        if model is None:
            load_error = model_loader.load_errors.get("thyroid_pred")
            raise RuntimeError(load_error or "Thyroid model is not loaded")

        feature_frame = self._build_feature_frame(payload, model)
        if feature_frame.empty:
            raise RuntimeError("No usable features provided for thyroid prediction")

        try:
            prediction_raw = model.predict(feature_frame)[0]
        except Exception as exc:
            logger.exception("Thyroid model inference failed")
            raise RuntimeError("Model inference failed") from exc

        recurrence_detected = self._is_positive_label(prediction_raw)
        
        # Binary classification only
        recurrence_prob = 1.0 if recurrence_detected else 0.0
        non_recurrence_prob = 1.0 if not recurrence_detected else 0.0
        confidence = 1.0
        risk_level = self._risk_level(recurrence_detected)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("thyroid_pred", duration_ms)

        return ThyroidResponse(
            success=True,
            prediction=ThyroidPredictionResult(
                recurrence_detected=recurrence_detected,
                risk_level=risk_level,
                confidence_score=confidence,
                recurrence_probability=recurrence_prob,
                class_probabilities=ThyroidClassProbabilities(
                    recurrence=recurrence_prob,
                    non_recurrence=non_recurrence_prob,
                ),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions.get("thyroid_pred", "1.0.0"),
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
