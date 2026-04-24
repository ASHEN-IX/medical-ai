from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence


logger = logging.getLogger(__name__)


class RoutingEngine:
    """Rule-based model selector with an easy hook for future LLM routing."""

    def __init__(self, use_llm_routing: bool = False) -> None:
        self.use_llm_routing = use_llm_routing

    def route(
        self,
        report_type: str,
        features: Mapping[str, Any],
        symptoms: Sequence[str] | None = None,
        has_image: bool = False,
    ) -> list[str]:
        if self.use_llm_routing:
            try:
                return self.llm_based_routing(report_type, features, symptoms, has_image)
            except NotImplementedError:
                logger.info("LLM-based routing is not available yet. Falling back to rules.")

        selected_models: set[str] = set()
        normalized_report_type = str(report_type or "auto").strip().lower()

        # Explicit report type has priority over auto-detection rules.
        if normalized_report_type in {"diabetes", "heart", "stroke"}:
            selected_models.add(normalized_report_type)

        if normalized_report_type in {"auto", "mixed"}:
            glucose = _to_float(features.get("glucose"))
            blood_pressure = _to_float(features.get("blood_pressure"))
            cholesterol = _to_float(features.get("cholesterol"))

            if glucose is not None and glucose > 140:
                selected_models.add("diabetes")

            if (blood_pressure is not None and blood_pressure > 130) or (
                cholesterol is not None and cholesterol > 200
            ):
                selected_models.add("heart")

            if self._has_stroke_indicators(features, symptoms):
                selected_models.add("stroke")

        if has_image:
            selected_models.add("autism_dl")

        if normalized_report_type == "mixed" and not selected_models:
            selected_models.update({"diabetes", "heart", "stroke"})

        ordered_models = sorted(selected_models, key=self._sort_order)
        return ordered_models

    def llm_based_routing(
        self,
        report_type: str,
        features: Mapping[str, Any],
        symptoms: Sequence[str] | None,
        has_image: bool,
    ) -> list[str]:
        raise NotImplementedError("LLM-based routing will be implemented in Sprint 6")

    def _has_stroke_indicators(self, features: Mapping[str, Any], symptoms: Sequence[str] | None) -> bool:
        if bool(features.get("neurological_symptoms")):
            return True

        candidates: list[str] = []
        if symptoms:
            candidates.extend([str(symptom).strip().lower() for symptom in symptoms])

        feature_symptoms = features.get("stroke_symptoms")
        if isinstance(feature_symptoms, (list, tuple)):
            candidates.extend([str(symptom).strip().lower() for symptom in feature_symptoms])
        elif isinstance(feature_symptoms, str):
            candidates.append(feature_symptoms.strip().lower())

        stroke_keywords = {
            "stroke",
            "slurred speech",
            "facial droop",
            "face droop",
            "arm weakness",
            "unilateral weakness",
            "vision loss",
            "numbness",
            "confusion",
        }
        return any(any(keyword in symptom for keyword in stroke_keywords) for symptom in candidates)

    def _sort_order(self, model_name: str) -> int:
        model_priority = {
            "diabetes": 1,
            "heart": 2,
            "stroke": 3,
            "autism_dl": 4,
        }
        return model_priority.get(model_name, 100)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None
