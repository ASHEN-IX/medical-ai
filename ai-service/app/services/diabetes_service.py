from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    DiabetesClassProbabilities,
    DiabetesPredictionResult,
    DiabetesRequest,
    DiabetesResponse,
    Metadata,
)
from app.services.model_loader import DIABETES_FEATURE_COLUMNS, model_loader


logger = logging.getLogger(__name__)


class DiabetesService:
    def _risk_level(self, probability: float) -> str:
        if probability >= 0.75:
            return "HIGH"
        if probability >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Clinical diabetes evaluation is strongly recommended",
                "Confirm with fasting plasma glucose or HbA1c testing",
                "Review lifestyle, medication, and metabolic risk factors",
            ]
        if risk_level == "MEDIUM":
            return [
                "Follow-up screening is recommended",
                "Monitor glucose trends and BMI-related risk factors",
                "Discuss preventive care with a healthcare professional",
            ]
        return [
            "Current model risk appears low",
            "Continue routine metabolic health monitoring",
            "Reassess if glucose, BMI, or symptoms change",
        ]

    def _build_feature_frame(self, payload: DiabetesRequest) -> pd.DataFrame:
        row: dict[str, Any] = {
            "Pregnancies": int(payload.pregnancies),
            "Glucose": float(payload.glucose),
            "BloodPressure": float(payload.blood_pressure),
            "SkinThickness": float(payload.skin_thickness),
            "Insulin": float(payload.insulin),
            "BMI": float(payload.bmi),
            "DiabetesPedigreeFunction": float(payload.diabetes_pedigree_function),
            "Age": int(payload.age),
        }

        expected_columns = model_loader.diabetes_feature_columns or DIABETES_FEATURE_COLUMNS
        normalized = {column: row.get(column, 0) for column in expected_columns}
        return pd.DataFrame([normalized], columns=expected_columns)

    def _is_diabetes_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "diabetic", "diabetes", "yes", "positive", "true"}

    def _probabilities(self, model: Any, feature_frame: pd.DataFrame, diabetic: bool) -> tuple[float, float]:
        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(feature_frame)[0], dtype=np.float32)
            if probs.ndim == 1 and probs.size >= 2:
                classes = getattr(model, "classes_", None)
                if classes is not None and len(classes) == probs.size:
                    class_map = {str(classes[idx]).strip().lower(): float(probs[idx]) for idx in range(probs.size)}
                    diabetes_prob = (
                        class_map.get("1")
                        or class_map.get("diabetic")
                        or class_map.get("diabetes")
                        or class_map.get("yes")
                        or class_map.get("positive")
                    )
                    # If still None, use index-based lookup for class 1 probability
                    if diabetes_prob is None:
                        # Always use probs[1] when diabetic (binary prediction=1)
                        diabetes_prob = float(probs[1]) if diabetic else float(probs[0])
                else:
                    diabetes_prob = float(probs[1])
            elif probs.ndim == 1 and probs.size == 1:
                diabetes_prob = float(probs[0]) if diabetic else 1.0 - float(probs[0])
            else:
                diabetes_prob = 1.0 if diabetic else 0.0
        else:
            diabetes_prob = 1.0 if diabetic else 0.0

        diabetes_prob = max(0.0, min(1.0, float(diabetes_prob)))
        non_diabetes_prob = 1.0 - diabetes_prob
        return diabetes_prob, non_diabetes_prob

    def predict(self, payload: DiabetesRequest, request_id: str) -> DiabetesResponse:
        started = time.perf_counter()
        model = model_loader.diabetes_model
        if model is None:
            load_error = model_loader.load_errors.get("diabetes_pred")
            raise RuntimeError(load_error or "Diabetes model is not loaded")

        feature_frame = self._build_feature_frame(payload)

        try:
            prediction_raw = model.predict(feature_frame)[0]
            # Ensure binary classification - round to nearest 0 or 1
            binary_prediction = int(round(float(prediction_raw)))
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            logger.exception("Diabetes model inference failed")
            raise RuntimeError("Model inference failed") from exc

        diabetic = self._is_diabetes_label(binary_prediction)
        diabetes_prob, non_diabetes_prob = self._probabilities(model, feature_frame, diabetic)
        confidence = diabetes_prob if diabetic else non_diabetes_prob
        risk_level = self._risk_level(diabetes_prob)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("diabetes_pred", duration_ms)

        return DiabetesResponse(
            success=True,
            prediction=DiabetesPredictionResult(
                diabetic=diabetic,
                risk_level=risk_level,
                confidence_score=round(confidence, 4),
                diabetes_probability=round(diabetes_prob, 4),
                class_probabilities=DiabetesClassProbabilities(
                    diabetic=round(diabetes_prob, 4),
                    non_diabetic=round(non_diabetes_prob, 4),
                ),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions["diabetes_pred"],
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
