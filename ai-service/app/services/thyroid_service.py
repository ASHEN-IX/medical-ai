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
    def _risk_level(self, probability: float) -> str:
        if probability >= 0.75:
            return "HIGH"
        if probability >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Endocrinology follow-up is strongly recommended",
                "Review post-treatment thyroid markers and imaging",
                "Consider accelerated monitoring schedule",
            ]
        if risk_level == "MEDIUM":
            return [
                "Clinical follow-up is recommended",
                "Track thyroid lab trends and symptom changes",
                "Repeat assessment on your clinician's advised interval",
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

        normalized = {column: self._to_float(feature_payload.get(column)) for column in expected_columns}
        return pd.DataFrame([normalized], columns=expected_columns)

    def _is_positive_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "true", "yes", "positive", "recurrence", "recurrent", "high"}

    def _probabilities(self, model: Any, feature_frame: pd.DataFrame, recurrence_detected: bool) -> tuple[float, float]:
        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(feature_frame)[0], dtype=np.float32)
            if probs.ndim == 1 and probs.size >= 2:
                classes = getattr(model, "classes_", None)
                if classes is not None and len(classes) == probs.size:
                    class_map = {str(classes[idx]).strip().lower(): float(probs[idx]) for idx in range(probs.size)}
                    recurrence_prob = (
                        class_map.get("1")
                        or class_map.get("positive")
                        or class_map.get("recurrence")
                        or class_map.get("recurrent")
                        or class_map.get("true")
                    )
                    # If still None, use index-based lookup for class 1 probability
                    if recurrence_prob is None:
                        # Always use probs[1] when recurrence detected (binary prediction=1)
                        recurrence_prob = float(probs[1]) if recurrence_detected else float(probs[0])
                else:
                    recurrence_prob = float(probs[1])
            elif probs.ndim == 1 and probs.size == 1:
                recurrence_prob = float(probs[0]) if recurrence_detected else 1.0 - float(probs[0])
            else:
                recurrence_prob = 1.0 if recurrence_detected else 0.0
        else:
            recurrence_prob = 1.0 if recurrence_detected else 0.0

        recurrence_prob = max(0.0, min(1.0, float(recurrence_prob)))
        non_recurrence_prob = 1.0 - recurrence_prob
        return recurrence_prob, non_recurrence_prob

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
        recurrence_prob, non_recurrence_prob = self._probabilities(model, feature_frame, recurrence_detected)
        confidence = recurrence_prob if recurrence_detected else non_recurrence_prob
        risk_level = self._risk_level(recurrence_prob)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("thyroid_pred", duration_ms)

        return ThyroidResponse(
            success=True,
            prediction=ThyroidPredictionResult(
                recurrence_detected=recurrence_detected,
                risk_level=risk_level,
                confidence_score=round(confidence, 4),
                recurrence_probability=round(recurrence_prob, 4),
                class_probabilities=ThyroidClassProbabilities(
                    recurrence=round(recurrence_prob, 4),
                    non_recurrence=round(non_recurrence_prob, 4),
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
