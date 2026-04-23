from __future__ import annotations

import base64
import io
import logging
import time
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageOps

from app.models.schemas import (
    AutismDLPredictionResult,
    AutismDLResponse,
    ClassProbabilities,
    ImageInput,
    Metadata,
)
from app.services.model_loader import model_loader


logger = logging.getLogger(__name__)


class AutismDLService:
    def __init__(self) -> None:
        self.image_size = (224, 224)

    def _decode_image(self, image_b64: str) -> Image.Image:
        payload = image_b64
        if image_b64.startswith("data:") and "," in image_b64:
            payload = image_b64.split(",", maxsplit=1)[1]

        try:
            image_bytes = base64.b64decode(payload, validate=True)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:  # pylint: disable=broad-except
            raise ValueError("Invalid base64 image payload") from exc

        return image

    def _preprocess(self, image: Image.Image) -> np.ndarray:
        resized = image.resize(self.image_size)
        image_array = np.asarray(resized, dtype=np.float32) / 255.0
        return np.expand_dims(image_array, axis=0)

    def _generate_heatmap(self, image: Image.Image) -> str:
        # Lightweight pseudo-heatmap for UI compatibility without expensive Grad-CAM.
        resized = image.resize(self.image_size)
        grayscale = ImageOps.autocontrast(resized.convert("L"))
        heatmap = ImageOps.colorize(grayscale, black="#0B1F3A", white="#FF8C42")

        buf = io.BytesIO()
        heatmap.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def _extract_probabilities(self, prediction_output: np.ndarray) -> tuple[float, float]:
        if prediction_output.ndim == 2 and prediction_output.shape[1] > 1:
            probs = prediction_output[0].astype(np.float32)
            total = float(np.sum(probs))
            if total > 0:
                probs = probs / total
            non_autism_prob = float(probs[0])
            autism_prob = float(probs[1])
        else:
            autism_prob = float(np.squeeze(prediction_output))
            autism_prob = max(0.0, min(1.0, autism_prob))
            non_autism_prob = 1.0 - autism_prob

        return autism_prob, non_autism_prob

    def predict(self, payload: ImageInput, request_id: str) -> AutismDLResponse:
        started = time.perf_counter()
        model = model_loader.autism_dl_model
        if model is None:
            load_error = model_loader.load_errors.get("autism_dl")
            raise RuntimeError(load_error or "Autism DL model is not loaded")

        image = self._decode_image(payload.image)
        model_input = self._preprocess(image)

        try:
            raw_prediction = np.asarray(model.predict(model_input, verbose=0), dtype=np.float32)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            logger.exception("Autism DL model inference failed")
            raise RuntimeError("Model inference failed") from exc

        autism_prob, non_autism_prob = self._extract_probabilities(raw_prediction)
        autism_detected = autism_prob >= 0.5
        confidence = autism_prob if autism_detected else non_autism_prob

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("autism_dl", duration_ms)

        heatmap_payload = self._generate_heatmap(image) if payload.return_heatmap else None

        return AutismDLResponse(
            success=True,
            prediction=AutismDLPredictionResult(
                autism_detected=autism_detected,
                confidence_score=round(confidence, 4),
                class_probabilities=ClassProbabilities(
                    autism=round(autism_prob, 4),
                    non_autism=round(non_autism_prob, 4),
                ),
            ),
            metadata=Metadata(
                model_version=payload.model_version or model_loader.model_versions["autism_dl"],
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            heatmap=heatmap_payload,
            request_id=request_id,
        )
