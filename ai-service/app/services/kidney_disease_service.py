from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    KidneyClassProbabilities,
    KidneyDiseasePredictionResult,
    KidneyDiseaseRequest,
    KidneyDiseaseResponse,
    Metadata,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class KidneyDiseaseService:
    BASE_FEATURE_DEFAULTS: dict[str, Any] = {
        "bp": 120,
        "su": 0,
        "rbc": 1,
        "pc": 1,
        "pcc": 0,
        "ba": 0,
        "bgr": 100,
        "bu": 25,
        "sod": 138,
        "pot": 4.5,
        "wc": 1,
        "rc": 4.5,
        "dm": 0,
        "cad": 0,
        "appet": 1,
        "pe": 0,
        "ane": 0,
    }

    def _risk_level(self, ckd_detected: bool) -> str:
        return "HIGH" if ckd_detected else "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Urgent nephrology follow-up recommended",
                "Order comprehensive renal panel and urinalysis",
                "Assess blood pressure and diabetes control",
            ]
        return [
            "Current model risk appears low",
            "Continue routine kidney health monitoring",
            "Reassess if new symptoms or risk factors emerge",
        ]

    def _build_feature_frame(self, payload: KidneyDiseaseRequest) -> pd.DataFrame:
        row: dict[str, Any] = {
            "age": float(payload.age),
            "hemo": float(payload.hemo),
            "sg": float(payload.sg),
            "al": int(payload.al),
            "pcv": float(payload.pcv),
            "sc": float(payload.sc),
            "htn": int(payload.htn),
            **self.BASE_FEATURE_DEFAULTS,
        }

        frame = pd.DataFrame([row])

        # Keep feature engineering aligned with the legacy training pipeline.
        frame["kidney_health_score"] = frame[["bu", "sc", "hemo"]].mean(axis=1)
        frame["sc_bu_ratio"] = frame["sc"] / (frame["bu"] + 1e-5)
        frame["age_sc_interaction"] = frame["age"] * frame["sc"]
        frame["age_squared"] = frame["age"] ** 2
        frame["high_risk"] = ((frame["htn"] == 1) & (frame["dm"] == 1)).astype(int)

        expected_columns = model_loader.kidney_feature_names
        if expected_columns:
            # Case-insensitive mapping from our engineered frame to the model's expected columns
            row_engineered = frame.iloc[0].to_dict()
            row_lower = {k.lower(): v for k, v in row_engineered.items()}
            normalized = {column: row_lower.get(column.lower(), 0) for column in expected_columns}
            frame = pd.DataFrame([normalized], columns=expected_columns)

        return frame

    def _is_ckd_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "ckd", "yes", "positive", "true"}

    def predict(self, payload: KidneyDiseaseRequest, request_id: str) -> KidneyDiseaseResponse:
        started = time.perf_counter()

        model = model_loader.kidney_disease_model
        scaler = model_loader.kidney_scaler
        if model is None or scaler is None:
            load_error = model_loader.load_errors.get("kidney_pred")
            raise RuntimeError(load_error or "Kidney disease model is not loaded")

        feature_frame = self._build_feature_frame(payload)

        try:
            scaled_input = scaler.transform(feature_frame)
            prediction_raw = model.predict(scaled_input)[0]
            # Ensure binary classification
            binary_prediction = int(round(float(prediction_raw)))
        except Exception as exc:  # pragma: no cover
            logger.exception("Kidney model inference failed")
            raise RuntimeError("Model inference failed") from exc

        label_encoder = model_loader.kidney_label_encoder
        decoded_label: Any = binary_prediction
        if label_encoder is not None:
            try:
                decoded_label = label_encoder.inverse_transform([int(binary_prediction)])[0]
            except Exception:  # pragma: no cover
                decoded_label = binary_prediction

        ckd_detected = self._is_ckd_label(decoded_label)
        
        # Binary classification only
        ckd_prob = 1.0 if ckd_detected else 0.0
        non_ckd_prob = 1.0 if not ckd_detected else 0.0
        confidence = 1.0
        risk_level = self._risk_level(ckd_detected)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("kidney_pred", duration_ms)

        return KidneyDiseaseResponse(
            success=True,
            prediction=KidneyDiseasePredictionResult(
                ckd_detected=ckd_detected,
                risk_level=risk_level,
                confidence_score=confidence,
                ckd_probability=ckd_prob,
                class_probabilities=KidneyClassProbabilities(
                    ckd=ckd_prob,
                    non_ckd=non_ckd_prob,
                ),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions["kidney_pred"],
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
