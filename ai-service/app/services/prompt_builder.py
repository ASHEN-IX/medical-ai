from __future__ import annotations

import json
from typing import Any, Iterable

from app.knowledge_graph.kg_schema import KnowledgeGraphContext


SYSTEM_PROMPT = """You are a medical explanation assistant.
You are not a doctor.
You are not diagnosing.
You only explain AI outputs.
You must use the provided RAG context as the truth source.
You must be conservative, careful, and safe.
If uncertain, say the result requires medical evaluation.
Never say phrases like 'you have X disease' or present the output as a diagnosis.
Return valid JSON only, matching the requested schema exactly.
"""


def build_explanation_messages(
    model_results: dict[str, Any],
    features: dict[str, Any],
    rag_context: Iterable[str],
    kg_context: KnowledgeGraphContext | None = None,
) -> list[dict[str, str]]:
    normalized_results = _normalize_for_prompt(model_results)
    normalized_features = _normalize_for_prompt(features)
    normalized_rag_context = _normalize_rag_context(rag_context)
    normalized_kg_context = _normalize_kg_context(kg_context)

    user_prompt = "\n".join(
        [
            "Produce a safe medical explanation in strict JSON.",
            "",
            "Model predictions:",
            _dump_json(normalized_results),
            "",
            "Extracted features:",
            _dump_json(normalized_features),
            "",
            "RAG context:",
            _format_rag_context(normalized_rag_context),
            "",
            "Knowledge graph context:",
            _dump_json(normalized_kg_context),
            "",
            "Rules:",
            "- Return only JSON.",
            "- Do not diagnose.",
            "- Use cautious wording.",
            "- If confidence is low or context is insufficient, say it requires medical evaluation.",
            "- Include a safety note.",
        ]
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def _normalize_for_prompt(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _normalize_for_prompt(sub_value) for key, sub_value in value.items()}

    if isinstance(value, list):
        return [_normalize_for_prompt(item) for item in value]

    if isinstance(value, tuple):
        return [_normalize_for_prompt(item) for item in value]

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    return str(value)


def _normalize_rag_context(rag_context: Iterable[str]) -> list[str]:
    deduplicated: list[str] = []
    seen: set[str] = set()

    for item in rag_context:
        cleaned = str(item).strip()
        if not cleaned:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        deduplicated.append(cleaned)

    return deduplicated[:8]


def _format_rag_context(rag_context: list[str]) -> str:
    if not rag_context:
        return "No RAG context was provided."

    lines = []
    for index, chunk in enumerate(rag_context, start=1):
        lines.append(f"{index}. {chunk}")
    return "\n".join(lines)


def _normalize_kg_context(kg_context: KnowledgeGraphContext | None) -> dict[str, Any]:
    if kg_context is None:
        return {
            "diseases": [],
            "symptoms": [],
            "risk_factors": [],
            "complications": [],
            "treatments": [],
        }

    payload = kg_context.model_dump(mode="json")
    payload["source_profiles"] = [
        _normalize_for_prompt(item) for item in payload.get("source_profiles", [])
    ]
    return payload


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=str)
