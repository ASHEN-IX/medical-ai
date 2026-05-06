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

    def _risk_level(self, probability: float) -> str:
        if probability >= 0.8:
            return "HIGH"
        if probability >= 0.45:
            return "MEDIUM"
        return "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Urgent nephrology follow-up recommended",
                "Order comprehensive renal panel and urinalysis",
                "Assess blood pressure and diabetes control",
            ]
        if risk_level == "MEDIUM":
            return [
                "Clinical follow-up and repeat screening recommended",
                "Monitor creatinine, hemoglobin, and urine protein trends",
                "Review cardiovascular and metabolic risk factors",
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
            normalized = {column: frame.iloc[0].get(column, 0) for column in expected_columns}
            frame = pd.DataFrame([normalized], columns=expected_columns)

        return frame

    def _is_ckd_label(self, label: Any) -> bool:
        text = str(label).strip().lower()
        return text in {"1", "ckd", "yes", "positive", "true"}

    def _probabilities(self, model: Any, scaled_input: Any, predicted_is_ckd: bool) -> tuple[float, float]:
        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(scaled_input)[0], dtype=np.float32)
            if probs.ndim == 1 and probs.size >= 2:
                classes = getattr(model, "classes_", None)
                if classes is not None and len(classes) == probs.size:
                    class_map = {str(classes[idx]).strip().lower(): float(probs[idx]) for idx in range(probs.size)}
                    ckd_prob = (
                        class_map.get("1")
                        or class_map.get("ckd")
                        or class_map.get("yes")
                        or class_map.get("positive")
                    )
                    # If still None, use index-based lookup for class 1 probability
                    if ckd_prob is None:
                        # Always use probs[1] when CKD detected (binary prediction=1)
                        ckd_prob = float(probs[1]) if predicted_is_ckd else float(probs[0])
                else:
                    ckd_prob = float(probs[1])
            elif probs.ndim == 1 and probs.size == 1:
                ckd_prob = float(probs[0]) if predicted_is_ckd else 1.0 - float(probs[0])
            else:
                ckd_prob = 1.0 if predicted_is_ckd else 0.0
        else:
            ckd_prob = 1.0 if predicted_is_ckd else 0.0

        ckd_prob = max(0.0, min(1.0, float(ckd_prob)))
        non_ckd_prob = 1.0 - ckd_prob
        return ckd_prob, non_ckd_prob

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
            # Ensure binary classification - round to nearest 0 or 1
            binary_prediction = int(round(float(prediction_raw)))
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            logger.exception("Kidney model inference failed")
            raise RuntimeError("Model inference failed") from exc

        label_encoder = model_loader.kidney_label_encoder
        decoded_label: Any = binary_prediction
        if label_encoder is not None:
            try:
                decoded_label = label_encoder.inverse_transform([int(binary_prediction)])[0]
            except Exception:  # pragma: no cover - runtime dependency behavior
                decoded_label = binary_prediction

        ckd_detected = self._is_ckd_label(decoded_label)
        ckd_prob, non_ckd_prob = self._probabilities(model, scaled_input, ckd_detected)
        confidence = ckd_prob if ckd_detected else non_ckd_prob
        risk_level = self._risk_level(ckd_prob)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("kidney_pred", duration_ms)

        return KidneyDiseaseResponse(
            success=True,
            prediction=KidneyDiseasePredictionResult(
                ckd_detected=ckd_detected,
                risk_level=risk_level,
                confidence_score=round(confidence, 4),
                ckd_probability=round(ckd_prob, 4),
                class_probabilities=KidneyClassProbabilities(
                    ckd=round(ckd_prob, 4),
                    non_ckd=round(non_ckd_prob, 4),
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
