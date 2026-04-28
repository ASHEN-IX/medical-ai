from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from app.models.llm_schema import LLMExplanationResponse, LLMRiskInterpretation


class LLMGuardrailError(ValueError):
    pass


_DIAGNOSIS_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\byou have\s+[a-z][\w\s-]{2,80}",
        r"\byou(?:'re| are)? diagnosed with\s+[a-z][\w\s-]{2,80}",
        r"\bthis means you have\s+[a-z][\w\s-]{2,80}",
        r"\bdiagnosis(?: is|:)?\s+[a-z][\w\s-]{2,80}",
        r"\bsuggests you have\s+[a-z][\w\s-]{2,80}",
    ]
]

_RISK_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def extract_confidence(model_results: Mapping[str, Any]) -> float:
    confidences: list[float] = []

    def _walk(value: Any) -> None:
        if isinstance(value, Mapping):
            for key in ("confidence", "confidence_score", "probability"):
                numeric = value.get(key)
                if isinstance(numeric, (int, float)):
                    confidences.append(float(numeric))

            for nested_value in value.values():
                _walk(nested_value)

        elif isinstance(value, list):
            for item in value:
                _walk(item)

    _walk(model_results)

    if not confidences:
        return 1.0

    return max(0.0, min(1.0, sum(confidences) / len(confidences)))


def extract_dominant_risk_level(model_results: Mapping[str, Any]) -> str:
    highest_level = "LOW"

    def _walk(value: Any) -> None:
        nonlocal highest_level
        if isinstance(value, Mapping):
            for key in ("risk", "risk_level", "overall_risk", "level"):
                candidate = value.get(key)
                if isinstance(candidate, str) and candidate.upper() in _RISK_ORDER:
                    if _RISK_ORDER[candidate.upper()] > _RISK_ORDER[highest_level]:
                        highest_level = candidate.upper()

            for nested_value in value.values():
                _walk(nested_value)

        elif isinstance(value, list):
            for item in value:
                _walk(item)

    _walk(model_results)
    return highest_level


def contains_diagnosis_language(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return False

    return any(pattern.search(cleaned) for pattern in _DIAGNOSIS_PATTERNS)


def ensure_safe_explanation(
    payload: LLMExplanationResponse,
    model_results: Mapping[str, Any],
    features: Mapping[str, Any],
    rag_context: list[str],
) -> LLMExplanationResponse:
    joined_fields = "\n".join(
        [
            payload.summary,
            "\n".join(payload.explanation),
            payload.risk_interpretation.meaning,
            "\n".join(payload.recommendations),
            payload.safety_note,
        ]
    )

    if contains_diagnosis_language(joined_fields):
        return build_safe_fallback_response(model_results, features, rag_context)

    confidence = extract_confidence(model_results)
    safety_note = payload.safety_note.strip() or "This does not replace medical advice."
    if confidence < 0.7 and "requires medical evaluation" not in safety_note.lower():
        safety_note = f"{safety_note} Confidence is low, so this requires medical evaluation."

    payload.safety_note = safety_note
    return payload


def build_safe_fallback_response(
    model_results: Mapping[str, Any],
    features: Mapping[str, Any],
    rag_context: list[str],
) -> LLMExplanationResponse:
    confidence = extract_confidence(model_results)
    risk_level = extract_dominant_risk_level(model_results)
    if confidence < 0.4 and risk_level == "LOW":
        risk_level = "MEDIUM"

    features_summary = ", ".join(f"{key}={value}" for key, value in list(features.items())[:6]) or "No structured features were provided."
    rag_summary = " ".join(rag_context[:3]) if rag_context else "No medical context was provided."
    model_summary = ", ".join(sorted(model_results.keys())) or "No model outputs were provided."

    return LLMExplanationResponse(
        summary="The AI outputs were reviewed as an explanation only. A clinician should interpret the results in context.",
        explanation=[
            f"Model outputs reviewed: {model_summary}.",
            f"Structured features reviewed: {features_summary}.",
            f"Medical context considered from RAG: {rag_summary}.",
            "The explanation stays conservative and does not replace clinical evaluation.",
        ],
        risk_interpretation=LLMRiskInterpretation(
            level=risk_level,
            meaning="This reflects relative concern in the AI output and should not be treated as a diagnosis.",
        ),
        recommendations=[
            "Review the result with a qualified clinician.",
            "Correlate the output with symptoms, history, and confirmatory tests.",
        ],
        safety_note="This does not replace medical advice.",
    )
