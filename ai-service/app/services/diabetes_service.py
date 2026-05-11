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
    def _risk_level(self, diabetic: bool) -> str:
        return "HIGH" if diabetic else "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Clinical diabetes evaluation is strongly recommended",
                "Confirm with fasting plasma glucose or HbA1c testing",
                "Review lifestyle, medication, and metabolic risk factors",
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
        # Case-insensitive mapping from our row to the model's expected columns
        row_lower = {k.lower(): v for k, v in row.items()}
        normalized = {column: row_lower.get(column.lower(), 0) for column in expected_columns}
        return pd.DataFrame([normalized], columns=expected_columns)

    def _is_diabetes_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "diabetic", "diabetes", "yes", "positive", "true"}

    def predict(self, payload: DiabetesRequest, request_id: str) -> DiabetesResponse:
        started = time.perf_counter()
        model = model_loader.diabetes_model
        if model is None:
            load_error = model_loader.load_errors.get("diabetes_pred")
            raise RuntimeError(load_error or "Diabetes model is not loaded")

        feature_frame = self._build_feature_frame(payload)

        try:
            prediction_raw = model.predict(feature_frame)[0]
            # Ensure binary classification
            binary_prediction = int(round(float(prediction_raw)))
        except Exception as exc:  # pragma: no cover
            logger.exception("Diabetes model inference failed")
            raise RuntimeError("Model inference failed") from exc

        diabetic = self._is_diabetes_label(binary_prediction)
        
        # Binary classification only
        diabetes_prob = 1.0 if diabetic else 0.0
        non_diabetes_prob = 1.0 if not diabetic else 0.0
        confidence = 1.0
        risk_level = self._risk_level(diabetic)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("diabetes_pred", duration_ms)

        return DiabetesResponse(
            success=True,
            prediction=DiabetesPredictionResult(
                diabetic=diabetic,
                risk_level=risk_level,
                confidence_score=confidence,
                diabetes_probability=diabetes_prob,
                class_probabilities=DiabetesClassProbabilities(
                    diabetic=diabetes_prob,
                    non_diabetic=non_diabetes_prob,
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
