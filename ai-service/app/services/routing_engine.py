from __future__ import annotations

import logging
from typing import Any, Mapping, Sequence

from app.utils.medical_patterns import KIDNEY_MARKER_KEYWORDS


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

        # STRICT ROUTING: If a specific disease is detected, route ONLY to that model.
        if normalized_report_type in {"diabetes", "heart", "kidney", "stroke", "liver", "autism"}:
            target_model = normalized_report_type
            if target_model == "autism":
                target_model = "autism_pred"
            
            selected_models.add(target_model)
            logger.info("Strict routing applied: report_type=%s -> model=%s", normalized_report_type, target_model)
            return sorted(selected_models)

        # Fallback for auto-detection if no specific type was detected
        if normalized_report_type in {"auto", "mixed"}:
            # Heuristic-based routing for auto / mixed reports.
            # Check for strong indicators first.
            if self._has_stroke_indicators(features, symptoms):
                selected_models.add("stroke")

            if self._has_kidney_indicators(features, symptoms):
                selected_models.add("kidney")

            # Diabetes indicators: glucose, hba1c
            glucose = _to_float(features.get("glucose"))
            hba1c = _to_float(features.get("hba1c"))
            if (glucose is not None and glucose > 125) or (hba1c is not None and hba1c >= 6.5):
                selected_models.add("diabetes")

            # Heart indicators: troponin, ecg, chest pain in symptoms
            troponin = _to_float(features.get("troponin"))
            if troponin is not None and troponin > 0.04:
                selected_models.add("heart")
            if symptoms and any("chest" in str(s).lower() or "pain" in str(s).lower() for s in symptoms):
                selected_models.add("heart")

            # Autism indicators: mention in symptoms or behavioral markers
            if symptoms and any("autism" in str(s).lower() or "behavior" in str(s).lower() for s in symptoms):
                selected_models.add("autism_pred")

            # If images present, consider autism_dl as an option
            if has_image:
                selected_models.add("autism_dl")

            # If heuristics found nothing, fall back to a safe default set
            if not selected_models:
                default_models = {"diabetes", "heart", "kidney"}
                selected_models.update(default_models)

            # Return a sorted list by priority
            result = sorted(selected_models, key=self._sort_order)
            logger.info("Auto/mixed routing selected models: %s", result)
            return result

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
            "kidney": 3,
            "stroke": 4,
            "autism_dl": 5,
        }
        return model_priority.get(model_name, 100)

    def _has_kidney_indicators(self, features: Mapping[str, Any], symptoms: Sequence[str] | None) -> bool:
        candidates: list[str] = []

        if symptoms:
            candidates.extend([str(symptom).strip().lower() for symptom in symptoms])

        for key, value in features.items():
            key_text = str(key).strip().lower()
            if any(marker in key_text for marker in KIDNEY_MARKER_KEYWORDS):
                return True

            if isinstance(value, str):
                candidates.append(value.strip().lower())

        kidney_keywords = {
            "creatinine",
            "egfr",
            "gfr",
            "bun",
            "urea",
            "albuminuria",
            "proteinuria",
            "ckd",
            "kidney",
            "renal",
            "swelling",
            "edema",
            "fatigue",
            "nausea",
            "vomiting",
            "urination",
            "urine",
            "itching",
            "cramps",
        }
        return any(any(keyword in candidate for keyword in kidney_keywords) for candidate in candidates)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None
