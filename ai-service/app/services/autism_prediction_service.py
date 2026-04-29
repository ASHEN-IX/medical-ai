from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.models.schemas import (
    AutismPredictionResult,
    CategoriesResponse,
    CategoryDefinition,
    CategoryOption,
    PredictionRequest,
    PredictionResponse,
    RiskCategories,
    SurveyResponses,
    Metadata,
)
from app.services.model_loader import DEFAULT_FEATURE_COLUMNS, model_loader


logger = logging.getLogger(__name__)


class AutismPredictionService:
    CATEGORY_COLUMNS = [
        "gender",
        "ethnicity",
        "jaundice",
        "austim",
        "contry_of_res",
        "used_app_before",
        "relation",
    ]

    FALLBACK_CATEGORY_OPTIONS: dict[str, list[str]] = {
        "gender": ["m", "f"],
        "ethnicity": ["White European", "Asian", "Middle Eastern", "Black", "Hispanic", "Others"],
        "jaundice": ["no", "yes"],
        "austim": ["no", "yes"],
        "contry_of_res": ["Unknown"],
        "used_app_before": ["no", "yes"],
        "relation": ["Self", "Parent", "Relative", "Health care professional", "Others"],
    }

    def _normalize(self, value: Any) -> str:
        return str(value).strip().lower()

    def _get_category_values(self, column: str) -> list[str]:
        encoder = model_loader.prediction_encoders.get(column)
        if encoder is not None and hasattr(encoder, "classes_"):
            classes = [str(v) for v in encoder.classes_]
            if classes:
                return classes
        return self.FALLBACK_CATEGORY_OPTIONS[column]

    def _encode_category(self, column: str, value: Any) -> int:
        values = self._get_category_values(column)
        if not values:
            return 0

        if value is None:
            return 0

        if isinstance(value, (int, float)) and int(value) == value:
            index = int(value)
            if 0 <= index < len(values):
                return index

        normalized_lookup = {self._normalize(item): idx for idx, item in enumerate(values)}
        normalized = self._normalize(value)
        if normalized in normalized_lookup:
            return normalized_lookup[normalized]

        valid_options = ", ".join(values)
        raise ValueError(f"Invalid value for {column}: {value}. Expected one of: {valid_options}")

    def _risk_level_from_probability(self, probability: float) -> str:
        if probability >= 0.75:
            return "HIGH"
        if probability >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _bucket_score(self, score: int, max_score: int) -> str:
        ratio = score / max_score if max_score else 0.0
        if ratio >= 0.7:
            return "HIGH"
        if ratio >= 0.4:
            return "MEDIUM"
        return "LOW"

    def _risk_categories(self, responses: SurveyResponses) -> RiskCategories:
        social = responses.A1_Score + responses.A2_Score + responses.A3_Score + responses.A4_Score + responses.A5_Score
        repetitive = responses.A6_Score + responses.A7_Score + responses.A8_Score
        sensory = responses.A9_Score + responses.A10_Score

        return RiskCategories(
            social_communication=self._bucket_score(social, 5),
            repetitive_behavior=self._bucket_score(repetitive, 3),
            sensory_sensitivity=self._bucket_score(sensory, 2),
        )

    def _recommendations(self, risk_level: str) -> list[str]:
        if risk_level == "HIGH":
            return [
                "Clinical assessment recommended",
                "Consult with autism specialist",
                "Consider developmental screening",
            ]
        if risk_level == "MEDIUM":
            return [
                "Follow-up screening is recommended",
                "Monitor behavioral changes over time",
                "Discuss results with a healthcare professional",
            ]
        return [
            "Current risk appears low",
            "Continue routine developmental monitoring",
            "Consult a clinician if new symptoms emerge",
        ]

    def _prepare_input_frame(self, payload: PredictionRequest) -> pd.DataFrame:
        responses = payload.responses
        demographics = payload.demographics

        austim_value = demographics.austim if demographics.austim is not None else 0
        used_before_value = demographics.used_app_before if demographics.used_app_before is not None else 0

        response_values = [
            responses.A1_Score,
            responses.A2_Score,
            responses.A3_Score,
            responses.A4_Score,
            responses.A5_Score,
            responses.A6_Score,
            responses.A7_Score,
            responses.A8_Score,
            responses.A9_Score,
            responses.A10_Score,
        ]

        computed_result = float(sum(response_values))
        feature_row = {
            "A1_Score": responses.A1_Score,
            "A2_Score": responses.A2_Score,
            "A3_Score": responses.A3_Score,
            "A4_Score": responses.A4_Score,
            "A5_Score": responses.A5_Score,
            "A6_Score": responses.A6_Score,
            "A7_Score": responses.A7_Score,
            "A8_Score": responses.A8_Score,
            "A9_Score": responses.A9_Score,
            "A10_Score": responses.A10_Score,
            "age": float(demographics.age or 0),
            "gender": self._encode_category("gender", demographics.gender),
            "ethnicity": self._encode_category("ethnicity", demographics.ethnicity),
            "jaundice": self._encode_category("jaundice", demographics.jaundice),
            "austim": self._encode_category("austim", austim_value),
            "contry_of_res": self._encode_category("contry_of_res", demographics.contry_of_res),
            "used_app_before": self._encode_category("used_app_before", used_before_value),
            "result": float(demographics.result) if demographics.result is not None else computed_result,
            "relation": self._encode_category("relation", demographics.relation),
        }

        feature_columns = model_loader.feature_columns or DEFAULT_FEATURE_COLUMNS
        normalized_row = {column: feature_row.get(column, 0) for column in feature_columns}
        return pd.DataFrame([normalized_row], columns=feature_columns)

    def predict(self, payload: PredictionRequest, request_id: str) -> PredictionResponse:
        started = time.perf_counter()
        model = model_loader.autism_prediction_model
        if model is None:
            load_error = model_loader.load_errors.get("autism_pred")
            raise RuntimeError(load_error or "Autism prediction model is not loaded")

        input_frame = self._prepare_input_frame(payload)

        try:
            prediction_raw = model.predict(input_frame)[0]
            predicted_label = int(prediction_raw)
        except Exception:  # pylint: disable=broad-except
            predicted_label = 1

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_frame)[0]
            if len(probabilities) > 1:
                non_autism_probability = float(probabilities[0])
                autism_probability = float(probabilities[1])
            else:
                autism_probability = float(probabilities[0])
                non_autism_probability = 1.0 - autism_probability
        else:
            autism_probability = float(predicted_label)
            non_autism_probability = 1.0 - autism_probability

        autism_probability = max(0.0, min(1.0, autism_probability))
        non_autism_probability = max(0.0, min(1.0, non_autism_probability))
        confidence = autism_probability if predicted_label == 1 else non_autism_probability
        risk_level = self._risk_level_from_probability(autism_probability)
        risk_categories = self._risk_categories(payload.responses)
        recommendations = self._recommendations(risk_level)

        duration_ms = int((time.perf_counter() - started) * 1000)
        model_loader.record_response_time("autism_pred", duration_ms)

        return PredictionResponse(
            success=True,
            prediction=AutismPredictionResult(
                risk_level=risk_level,
                autism_probability=round(autism_probability, 4),
                confidence_score=round(confidence, 4),
                risk_categories=risk_categories,
            ),
            recommendations=recommendations,
            metadata=Metadata(
                model_version=model_loader.model_versions["autism_pred"],
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
            ),
            request_id=request_id,
        )

    def get_categories(self) -> CategoriesResponse:
        categories = {}
        for column in ["gender", "ethnicity", "relation"]:
            values = self._get_category_values(column)
            categories[column] = CategoryDefinition(
                options=[
                    CategoryOption(code=index, label=value, display=value)
                    for index, value in enumerate(values)
                ]
            )

        return CategoriesResponse(success=True, categories=categories)
