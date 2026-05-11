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
    def _risk_level(self, heart_detected: bool) -> str:
        return "HIGH" if heart_detected else "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return ["Urgent cardiology referral recommended", "Consider ECG and cardiac enzymes"]
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
                        else:
                            prediction_raw = int(preds[0][1] >= 0.5)
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

        # Binary classification only
        heart_detected = bool(int(round(float(prediction_raw))) == 1)
        heart_prob = 1.0 if heart_detected else 0.0
        confidence = 1.0
        risk_level = self._risk_level(heart_detected)

        duration_ms = int((time.time() - started) * 1000)
        model_loader.record_response_time("heart_pred", duration_ms)

        return HeartResponse(
            success=True,
            prediction=HeartPredictionResult(
                heart_disease=heart_detected,
                risk_level=risk_level,
                confidence_score=confidence,
                heart_probability=heart_prob,
                class_probabilities=HeartClassProbabilities(heart_disease=heart_prob, non_heart_disease=1.0 - heart_prob),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions.get("heart_pred", "v1.0"),
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
