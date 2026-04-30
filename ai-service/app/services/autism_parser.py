from __future__ import annotations

import re
import logging
from typing import Any

from app.models.schemas import PredictionRequest, SurveyResponses, Demographics

logger = logging.getLogger(__name__)


_A_SCORE_PATTERN = re.compile(r"\bA(\d{1,2})[_\s:-]*\s*(?:Score)?\s*[:=]?\s*([01])\b", re.IGNORECASE)
_A_SCORE_ALT_PATTERN = re.compile(r"\bA(\d{1,2})\b\s*[\-\)]?\s*[:\)]?\s*(yes|no|1|0)\b", re.IGNORECASE)
_A_ITEM_PATTERN = re.compile(r"\bA(\d{1,2})\b", re.IGNORECASE)

_AGE_PATTERN = re.compile(r"\bage\b[^\d]{0,3}(\d{1,3})\b", re.IGNORECASE)
_GENDER_PATTERN = re.compile(r"\b(male|female|m|f)\b", re.IGNORECASE)
_YES_NO_PATTERN = re.compile(r"\b(yes|no|y|n)\b", re.IGNORECASE)


def _extract_binary_answers(text: str) -> dict[str, int]:
    answers: dict[str, int] = {}

    for m in _A_SCORE_PATTERN.finditer(text):
        idx = int(m.group(1))
        if 1 <= idx <= 10:
            answers[f"A{idx}_Score"] = int(m.group(2))

    if len(answers) < 10:
        for m in _A_SCORE_ALT_PATTERN.finditer(text):
            idx = int(m.group(1))
            if 1 <= idx <= 10 and f"A{idx}_Score" not in answers:
                val = m.group(2).lower()
                answers[f"A{idx}_Score"] = 1 if val in {"yes", "1", "y"} else 0

    if len(answers) < 10:
        item_matches = list(_A_ITEM_PATTERN.finditer(text))
        for index, match in enumerate(item_matches):
            idx = int(match.group(1))
            if not 1 <= idx <= 10 or f"A{idx}_Score" in answers:
                continue

            next_start = item_matches[index + 1].start() if index + 1 < len(item_matches) else len(text)
            segment = text[match.end() : next_start]
            segment_matches = list(re.finditer(r"\b(yes|no|1|0)\b", segment, re.IGNORECASE))
            if not segment_matches:
                continue

            val = segment_matches[-1].group(1).lower()
            answers[f"A{idx}_Score"] = 1 if val in {"yes", "1"} else 0

    return answers


def _extract_age(text: str) -> int | None:
    m = _AGE_PATTERN.search(text)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _extract_gender(text: str) -> str | None:
    m = _GENDER_PATTERN.search(text)
    if not m:
        return None
    val = m.group(1).lower()
    if val.startswith("m"):
        return "0"
    if val.startswith("f"):
        return "1"
    return None


def parse_autism_prediction_request(text: str) -> PredictionRequest:
    """Parse `raw_text` from reports/ocr and build a `PredictionRequest`.

    This uses conservative regex rules based on the legacy Gradio fields (A1..A10 and demographics).
    Missing fields are filled with sensible defaults and logged.
    """
    answers = _extract_binary_answers(text)

    # default to 0 for missing answers
    scores = {}
    for i in range(1, 11):
        key = f"A{i}_Score"
        scores[key] = int(answers.get(key, 0))

    age = _extract_age(text)
    if age is None:
        age = 0

    gender = int(_extract_gender(text) or "0")

    # best-effort extraction for other categorical fields using simple heuristics
    jaundice = None
    if "jaundice" in text.lower():
        # try to find nearby yes/no
        m = re.search(r"jaundice[\s:\-]*\s*(yes|no|1|0)", text, re.IGNORECASE)
        if m:
            jaundice = "yes" if m.group(1).lower().startswith("y") or m.group(1) == "1" else "no"

    # build SurveyResponses and Demographics
    responses = SurveyResponses(**{k: v for k, v in scores.items()})

    demographics = Demographics(
        gender=gender,
        age=age,
        ethnicity=None,
        jaundice=jaundice,
        relation=None,
        austim=None,
        contry_of_res=0,
        used_app_before=None,
        result=None,
    )

    logger.info("Parsed autism prediction request: age=%s gender=%s filled_scores=%d/10", age, gender, sum(scores.values()))
    return PredictionRequest(responses=responses, demographics=demographics)
