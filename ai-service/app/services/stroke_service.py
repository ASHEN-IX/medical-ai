from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    StrokeClassProbabilities,
    StrokePredictionResult,
    StrokeRequest,
    StrokeResponse,
    Metadata,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class StrokeService:

    def _risk_level(self, stroke_detected: bool) -> str:
        return "HIGH" if stroke_detected else "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Urgent neurological consultation recommended",
                "Assess cardiovascular and metabolic risk factors",
                "Consider preventive medication/therapy",
                "Monitor blood pressure and glucose levels regularly",
            ]
        return [
            "Current stroke risk appears low",
            "Continue regular health monitoring",
            "Maintain healthy lifestyle habits",
            "Reassess if new symptoms emerge",
        ]

    def _build_feature_frame(self, payload: StrokeRequest):
        ever_married_no = 1 if payload.ever_married == "No" else 0
        ever_married_yes = 1 if payload.ever_married == "Yes" else 0
        work_self_employed = 1 if payload.work_type == "Self-employed" else 0
        work_children = 1 if payload.work_type == "children" else 0
        smoking_unknown = 1 if payload.smoking_status == "Unknown" else 0
        smoking_formerly_smoked = 1 if payload.smoking_status == "formerly smoked" else 0

        numeric_frame = pd.DataFrame([{
            "age": float(payload.age),
            "avg_glucose_level": float(payload.avg_glucose_level),
            "bmi": float(payload.bmi),
        }])

        model_frame = pd.DataFrame([{
            "age": float(payload.age),
            "hypertension": int(payload.hypertension),
            "heart_disease": int(payload.heart_disease),
            "bmi": float(payload.bmi),
            "ever_married_No": ever_married_no,
            "ever_married_Yes": ever_married_yes,
            "work_type_Self-employed": work_self_employed,
            "work_type_children": work_children,
            "smoking_status_Unknown": smoking_unknown,
            "smoking_status_formerly smoked": smoking_formerly_smoked,
        }])

        return numeric_frame, model_frame

    def predict(
        self, payload: StrokeRequest, request_id: str
    ) -> StrokeResponse:
        started = time.perf_counter()

        model = model_loader.stroke_model
        scaler = model_loader.stroke_scaler

        if model is None or scaler is None:
            load_error = model_loader.load_errors.get("stroke_pred")
            raise RuntimeError(load_error or "Stroke model is not loaded")

        numeric_frame, model_frame = self._build_feature_frame(payload)

        try:
            scaled_numeric = scaler.transform(numeric_frame)
            model_frame["age"] = scaled_numeric[0][0]
            model_frame["bmi"] = scaled_numeric[0][2]
            prediction_raw = model.predict(model_frame)[0]
        except Exception as exc:
            logger.exception("Stroke model inference failed")
            raise RuntimeError("Model inference failed") from exc

        stroke_detected = bool(int(round(float(prediction_raw))) == 1)
        
        # Binary classification only
        stroke_prob = 1.0 if stroke_detected else 0.0
        non_stroke_prob = 1.0 if not stroke_detected else 0.0
        confidence = 1.0
        risk_level = self._risk_level(stroke_detected)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("stroke_pred", duration_ms)

        return StrokeResponse(
            success=True,
            prediction=StrokePredictionResult(
                stroke_detected=stroke_detected,
                risk_level=risk_level,
                confidence_score=confidence,
                stroke_probability=stroke_prob,
                class_probabilities=StrokeClassProbabilities(
                    stroke=stroke_prob,
                    non_stroke=non_stroke_prob,
                ),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions.get("stroke_pred", "1.0.0"),
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )