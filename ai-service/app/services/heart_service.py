from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any
import re

import numpy as np
import pandas as pd

from app.models.schemas import (
    HeartClassProbabilities,
    HeartPredictionResult,
    HeartRequest,
    HeartResponse,
    Metadata,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class HeartService:
    def _risk_level(self, probability: float) -> str:
        if probability >= 0.75:
            return "HIGH"
        if probability >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return ["Urgent cardiology referral recommended", "Consider ECG and cardiac enzymes"]
        if risk_level == "MEDIUM":
            return ["Follow-up cardiovascular assessment", "Lifestyle counseling for risk reduction"]
        return ["Continue routine monitoring and healthy lifestyle"]

    def _build_feature_frame(self, payload: HeartRequest) -> pd.DataFrame:
        row: dict[str, Any] = {
            "age": int(payload.age),
            "blood_pressure": float(payload.blood_pressure),
            "cholesterol": float(payload.cholesterol),
            "bmi": float(payload.bmi),
        }

        # If a preprocessor exists, ModelClient may expect raw values; keep simple DataFrame
        return pd.DataFrame([row])

    def predict(self, payload: HeartRequest, request_id: str) -> HeartResponse:
        started = time.time()
        model = model_loader.heart_model
        if model is None:
            load_error = model_loader.load_errors.get("heart_pred")
            raise RuntimeError(load_error or "Heart model is not loaded")

        feature_frame = self._build_feature_frame(payload)

        # If a preprocessor (pipeline or transformer) exists, apply it before prediction
        try:
            input_for_model = feature_frame
            pre = model_loader.heart_preprocessor
            if pre is not None:
                try:
                    # If preprocessor is a transformer that expects a DataFrame or 2D array
                    input_for_model = pre.transform(feature_frame)
                except Exception:
                    # Some preprocessors may be pipelines or dict-like; try joblib-loaded pipeline predict
                    try:
                        input_for_model = pre(feature_frame)
                    except Exception:
                        input_for_model = feature_frame

            # Some legacy XGBoost pickled estimators expect attributes that may be missing
            if not hasattr(model, "use_label_encoder"):
                try:
                    setattr(model, "use_label_encoder", False)
                except Exception:
                    pass

            # Prefer using XGBoost Booster directly to avoid sklearn wrapper attribute access
            prediction_raw = None
            try:
                if hasattr(model, "get_booster"):
                    try:
                        import xgboost as xgb

                        arr = input_for_model.values if hasattr(input_for_model, "values") else input_for_model
                        dmat = xgb.DMatrix(arr)
                        booster = model.get_booster()
                        preds = booster.predict(dmat)
                        # preds may be probabilities for binary classification
                        if hasattr(preds, "shape") and getattr(preds, "ndim", 1) == 1:
                            prediction_raw = int(preds[0] >= 0.5)
                            proba_est = float(preds[0])
                        else:
                            prediction_raw = int(preds[0][1] >= 0.5)
                            proba_est = float(preds[0][1])
                    except Exception:
                        prediction_raw = None

                if prediction_raw is None:
                    # Fallback to sklearn wrapper predict, with retry to patch missing attributes
                    for attempt in range(3):
                        try:
                            prediction_raw = model.predict(input_for_model)[0]
                            break
                        except AttributeError as ae:
                            m = re.search(r"has no attribute '(.+?)'", str(ae))
                            if m:
                                attr = m.group(1)
                                try:
                                    setattr(model, attr, False)
                                except Exception:
                                    try:
                                        setattr(model, attr, None)
                                    except Exception:
                                        pass
                                continue
                            raise
                    if prediction_raw is None:
                        prediction_raw = model.predict(input_for_model)[0]
            except Exception as exc:
                raise
        except Exception as exc:
            logger.exception("Heart model inference failed")
            raise RuntimeError(f"Model inference failed: {exc}") from exc

        # Determine probability
        heart_prob = None
        # If we previously estimated probability from Booster, use it
        if "proba_est" in locals():
            heart_prob = float(locals()["proba_est"])

        if heart_prob is None:
            # Try using booster predict to get probabilities without sklearn wrapper
            try:
                if hasattr(model, "get_booster"):
                    import xgboost as xgb

                    arr = feature_frame.values if hasattr(feature_frame, "values") else feature_frame
                    dmat = xgb.DMatrix(arr)
                    booster = model.get_booster()
                    preds = booster.predict(dmat)
                    if hasattr(preds, "ndim") and preds.ndim == 1:
                        heart_prob = float(preds[0])
                    else:
                        heart_prob = float(preds[0][1])
            except Exception:
                heart_prob = None

        if heart_prob is None:
            if hasattr(model, "predict_proba"):
                try:
                    probs = np.asarray(model.predict_proba(feature_frame)[0], dtype=np.float32)
                    if probs.size >= 2:
                        heart_prob = float(probs[1])
                    else:
                        heart_prob = float(probs[0])
                except Exception:
                    heart_prob = float(prediction_raw) if isinstance(prediction_raw, (int, float)) else 0.0
            else:
                heart_prob = float(prediction_raw) if isinstance(prediction_raw, (int, float)) else 0.0

        heart_prob = max(0.0, min(1.0, heart_prob))
        # Use binary prediction (0 or 1) directly for disease detection, not probability threshold
        heart_detected = bool(prediction_raw == 1)
        confidence = heart_prob if heart_detected else 1.0 - heart_prob

        duration_ms = int((time.time() - started) * 1000)
        model_loader.record_response_time("heart_pred", duration_ms)

        risk_level = self._risk_level(heart_prob)

        return HeartResponse(
            success=True,
            prediction=HeartPredictionResult(
                heart_disease=heart_detected,
                risk_level=risk_level,
                confidence_score=round(confidence, 4),
                heart_probability=round(heart_prob, 4),
                class_probabilities=HeartClassProbabilities(heart_disease=round(heart_prob, 4), non_heart_disease=round(1.0 - heart_prob, 4)),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions.get("heart_pred", "v1.0"),
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
