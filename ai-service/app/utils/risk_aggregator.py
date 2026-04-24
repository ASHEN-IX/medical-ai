from __future__ import annotations

from typing import Any, Mapping, Sequence


RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def normalize_risk(raw_risk: str | None, confidence: float | None = None) -> str:
    if raw_risk:
        normalized = str(raw_risk).strip().upper()
        synonyms = {
            "SEVERE": "HIGH",
            "CRITICAL": "HIGH",
            "MODERATE": "MEDIUM",
            "NORMAL": "LOW",
        }
        normalized = synonyms.get(normalized, normalized)
        if normalized in RISK_ORDER:
            return normalized

    if confidence is None:
        return "LOW"

    if confidence >= 0.75:
        return "HIGH"
    if confidence >= 0.5:
        return "MEDIUM"
    return "LOW"


def aggregate_overall_risk(results: Mapping[str, Mapping[str, Any]]) -> str:
    if not results:
        return "LOW"

    risk_levels = []
    for payload in results.values():
        confidence = _to_float(payload.get("confidence"))
        risk_levels.append(normalize_risk(payload.get("risk"), confidence))

    if any(level == "HIGH" for level in risk_levels):
        return "HIGH"

    if sum(1 for level in risk_levels if level == "MEDIUM") >= 2:
        return "MEDIUM"

    return "LOW"


def priority_from_risk(overall_risk: str) -> str:
    normalized = normalize_risk(overall_risk)
    if normalized == "HIGH":
        return "URGENT"
    if normalized == "MEDIUM":
        return "MEDIUM"
    return "LOW"


def build_reasoning(
    features: Mapping[str, Any],
    results: Mapping[str, Mapping[str, Any]],
    selected_models: Sequence[str],
    symptoms: Sequence[str] | None = None,
    failures: Mapping[str, str] | None = None,
    fallback_models: Sequence[str] | None = None,
) -> list[str]:
    reasoning: list[str] = []

    glucose = _to_float(features.get("glucose"))
    if glucose is not None and glucose > 140:
        reasoning.append("High glucose detected")

    blood_pressure = _to_float(features.get("blood_pressure"))
    if blood_pressure is not None and blood_pressure > 130:
        reasoning.append("Elevated blood pressure detected")

    cholesterol = _to_float(features.get("cholesterol"))
    if cholesterol is not None and cholesterol > 200:
        reasoning.append("Elevated cholesterol detected")

    if _has_neurological_symptoms(features, symptoms):
        reasoning.append("Neurological stroke-related symptoms detected")

    for model_name in selected_models:
        model_payload = results.get(model_name)
        if model_payload is None:
            continue
        risk_level = normalize_risk(model_payload.get("risk"), _to_float(model_payload.get("confidence")))
        if risk_level == "HIGH":
            reasoning.append(f"{model_name} model returned HIGH risk")

    if fallback_models:
        deduped_fallbacks = sorted(set(fallback_models))
        model_list = ", ".join(deduped_fallbacks)
        reasoning.append(f"Fallback risk estimation used for: {model_list}")

    if failures:
        reasoning.append("Partial model results returned due to timeout or downstream model errors")

    if not reasoning:
        reasoning.append("Features were analyzed by the selected AI models")

    return reasoning


def _has_neurological_symptoms(features: Mapping[str, Any], symptoms: Sequence[str] | None) -> bool:
    symptom_candidates = []

    if symptoms:
        symptom_candidates.extend([str(item).strip().lower() for item in symptoms])

    feature_symptoms = features.get("neurological_symptoms")
    if isinstance(feature_symptoms, (list, tuple)):
        symptom_candidates.extend([str(item).strip().lower() for item in feature_symptoms])
    elif isinstance(feature_symptoms, str):
        symptom_candidates.append(feature_symptoms.strip().lower())

    keywords = {
        "slurred speech",
        "facial droop",
        "face droop",
        "numbness",
        "weakness",
        "confusion",
        "vision loss",
        "neurological",
    }
    return any(any(keyword in entry for keyword in keywords) for entry in symptom_candidates)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None
