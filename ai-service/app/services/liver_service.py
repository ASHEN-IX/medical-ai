from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import (
    LiverClassProbabilities,
    LiverPredictionResult,
    LiverRequest,
    LiverResponse,
    Metadata,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class LiverService:
    def _risk_level(self, probability: float) -> str:
        if probability >= 0.75:
            return "HIGH"
        if probability >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return ["Refer to hepatology for further assessment", "Consider imaging and liver panel tests"]
        if risk_level == "MEDIUM":
            return ["Repeat labs and monitor liver enzymes", "Review medication and alcohol exposure"]
        return ["Maintain regular check-ups and healthy lifestyle"]

    def _build_feature_frame(self, payload: LiverRequest) -> pd.DataFrame:
        # Map incoming payload to the feature names expected by the trained model
        # Expected feature names (observed from model.feature_names_in_):
        # ['Age','Gender','Total_Bilirubin','Direct_Bilirubin','Alkaline_Phosphotase',
        #  'Alamine_Aminotransferase','Aspartate_Aminotransferase','Total_Protiens',
        #  'Albumin','Albumin_and_Globulin_Ratio']
        row: dict[str, Any] = {
            "Age": int(payload.age),
            "Gender": None,
            "Total_Bilirubin": float(payload.total_bilirubin),
            "Direct_Bilirubin": float(payload.direct_bilirubin),
            "Alkaline_Phosphotase": float(payload.alkaline_phosphotase),
            "Alamine_Aminotransferase": float(payload.alanine_aminotransferase),
            "Aspartate_Aminotransferase": float(payload.aspartate_aminotransferase),
            "Total_Protiens": float(payload.total_protiens) if payload.total_protiens is not None else 0.0,
            "Albumin": float(payload.albumin),
            "Albumin_and_Globulin_Ratio": float(payload.albumin_and_globulin_ratio)
            if payload.albumin_and_globulin_ratio is not None
            else 0.0,
        }

        # Encode gender if encoder is available; otherwise try common mappings
        liver_enc = model_loader.liver_label_encoder
        if payload.gender is not None and liver_enc is not None:
            try:
                encoded = liver_enc.transform([payload.gender])[0]
                row["Gender"] = encoded
            except Exception:
                try:
                    # Try common alternative casing
                    encoded = liver_enc.transform([str(payload.gender).title()])[0]
                    row["Gender"] = encoded
                except Exception:
                    # Fallback: map common strings to simple numeric values used in some datasets
                    gender_val = None
                    if isinstance(payload.gender, str):
                        g = payload.gender.strip().lower()
                        if g in {"male", "m"}:
                            gender_val = 1
                        elif g in {"female", "f"}:
                            gender_val = 0
                    row["Gender"] = gender_val
        else:
            # Fallback: map common strings to simple numeric values used in some datasets
            gender_val = None
            if isinstance(payload.gender, str):
                g = payload.gender.strip().lower()
                if g in {"male", "m"}:
                    gender_val = 1
                elif g in {"female", "f"}:
                    gender_val = 0
            row["Gender"] = gender_val

        return pd.DataFrame([row], columns=[
            "Age",
            "Gender",
            "Total_Bilirubin",
            "Direct_Bilirubin",
            "Alkaline_Phosphotase",
            "Alamine_Aminotransferase",
            "Aspartate_Aminotransferase",
            "Total_Protiens",
            "Albumin",
            "Albumin_and_Globulin_Ratio",
        ])

    def predict(self, payload: LiverRequest, request_id: str) -> LiverResponse:
        started = time.time()
        model = model_loader.liver_model
        if model is None:
            load_error = model_loader.load_errors.get("liver_pred")
            raise RuntimeError(load_error or "Liver model is not loaded")

        feature_frame = self._build_feature_frame(payload)

        # Apply any liver preprocessor if available
        try:
            input_for_model = feature_frame
            pre = getattr(model_loader, "liver_preprocessor", None)
            if pre is not None:
                try:
                    input_for_model = pre.transform(feature_frame)
                except Exception:
                    try:
                        input_for_model = pre(feature_frame)
                    except Exception:
                        input_for_model = feature_frame

            # Retry loop to handle legacy estimator attribute issues
            prediction_raw = None
            for attempt in range(3):
                try:
                    prediction_raw = model.predict(input_for_model)[0]
                    break
                except AttributeError as ae:
                    msg = str(ae)
                    import re

                    m = re.search(r"has no attribute '(.+?)'", msg)
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
            logger.exception("Liver model inference failed")
            raise RuntimeError(f"Model inference failed: {exc}") from exc

        # Try to obtain probability safely; fall back to binary prediction when proba path fails
        liver_prob = None
        if hasattr(model, "predict_proba"):
            try:
                probs = np.asarray(model.predict_proba(feature_frame)[0], dtype=np.float32)
                liver_prob = float(probs[1]) if probs.size >= 2 else float(probs[0])
            except AttributeError as ae:
                # Handle missing legacy attributes (e.g., multi_class on old LogisticRegression)
                msg = str(ae)
                import re

                m = re.search(r"has no attribute '(.+?)'", msg)
                if m and m.group(1) == "multi_class":
                    try:
                        setattr(model, "multi_class", "ovr")
                        probs = np.asarray(model.predict_proba(feature_frame)[0], dtype=np.float32)
                        liver_prob = float(probs[1]) if probs.size >= 2 else float(probs[0])
                    except Exception:
                        liver_prob = None
                else:
                    liver_prob = None
            except Exception:
                liver_prob = None

        if liver_prob is None:
            liver_prob = float(prediction_raw) if isinstance(prediction_raw, (int, float)) else 0.0

        liver_prob = max(0.0, min(1.0, liver_prob))
        liver_detected = bool(prediction_raw) and liver_prob >= 0.5
        confidence = liver_prob if liver_detected else 1.0 - liver_prob

        duration_ms = int((time.time() - started) * 1000)
        model_loader.record_response_time("liver_pred", duration_ms)

        risk_level = self._risk_level(liver_prob)

        return LiverResponse(
            success=True,
            prediction=LiverPredictionResult(
                liver_disease=liver_detected,
                risk_level=risk_level,
                confidence_score=round(confidence, 4),
                liver_probability=round(liver_prob, 4),
                class_probabilities=LiverClassProbabilities(liver_disease=round(liver_prob, 4), non_liver_disease=round(1.0 - liver_prob, 4)),
            ),
            recommendations=self._recommendations(risk_level),
            metadata=Metadata(
                model_version=model_loader.model_versions.get("liver_pred", "v1.0"),
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )
