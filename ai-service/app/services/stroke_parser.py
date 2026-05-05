"""
Stroke prediction parser - extracts structured data from raw text/OCR.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for stroke fields
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_GLUCOSE_PATTERN = re.compile(r"(?:glucose|blood glucose|avg glucose|average glucose)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_BMI_PATTERN = re.compile(r"(?:BMI|body mass index|bmi)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)
_HTN_PATTERN = re.compile(r"(?:hypertension|HTN|high blood pressure)\s*[:=]?\s*(yes|no|1|0)", re.IGNORECASE)
_HEART_DISEASE_PATTERN = re.compile(r"(?:heart disease|cardiac|coronary|MI history)\s*[:=]?\s*(yes|no|1|0)", re.IGNORECASE)
_MARRIED_PATTERN = re.compile(r"(?:married|marital status)\s*[:=]?\s*(yes|no|married|single)", re.IGNORECASE)
_WORK_PATTERN = re.compile(r"(?:work type|employment|occupation)\s*[:=]?\s*(\w+)", re.IGNORECASE)
_SMOKING_PATTERN = re.compile(r"(?:smoking|smokes|smoker)\s*[:=]?\s*(\w+)", re.IGNORECASE)


def _extract_float(text: str, pattern: re.Pattern, group: int = 1) -> float | None:
    """Extract a float value using regex pattern."""
    m = pattern.search(text)
    if m:
        try:
            return float(m.group(group))
        except (ValueError, TypeError):
            pass
    return None


def _extract_int(text: str, pattern: re.Pattern, group: int = 1) -> int | None:
    """Extract an integer value using regex pattern."""
    m = pattern.search(text)
    if m:
        try:
            return int(m.group(group))
        except (ValueError, TypeError):
            pass
    return None


def _extract_binary(text: str, pattern: re.Pattern) -> int | None:
    """Extract a binary (yes/no) value."""
    m = pattern.search(text)
    if m:
        val = m.group(1).lower()
        return 1 if val in {"yes", "1", "y"} else 0
    return None


def _extract_marital_status(text: str) -> str | None:
    """Extract marital status (Yes/No format)."""
    m = _MARRIED_PATTERN.search(text)
    if m:
        val = m.group(1).lower()
        return "Yes" if val in {"yes", "married", "1"} else "No"
    return None


def _extract_work_type(text: str) -> str | None:
    """Extract work type and normalize."""
    valid_types = ["Self-employed", "children", "Private", "Govt_job", "Never_worked"]
    m = _WORK_PATTERN.search(text)
    if m:
        val = m.group(1).lower()
        for wtype in valid_types:
            if val in wtype.lower():
                return wtype
    return None


def _extract_smoking_status(text: str) -> str | None:
    """Extract smoking status and normalize."""
    m = _SMOKING_PATTERN.search(text)
    if m:
        val = m.group(1).lower()
        if "never" in val:
            return "never smoked"
        elif "former" in val or "quit" in val:
            return "formerly smoked"
        elif "smokes" in val or "currently" in val:
            return "smokes"
        elif val in {"yes", "1"}:
            return "smokes"
    return None


def parse_stroke_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from stroke risk screening and extract fields.
    Returns dict with extracted values and defaults for missing fields.
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "age": _extract_float(text, _AGE_PATTERN) or 45.0,
        "hypertension": _extract_binary(text, _HTN_PATTERN) or 0,
        "heart_disease": _extract_binary(text, _HEART_DISEASE_PATTERN) or 0,
        "bmi": _extract_float(text, _BMI_PATTERN) or 24.5,
        "ever_married": _extract_marital_status(text) or "No",
        "work_type": _extract_work_type(text) or "Private",
        "smoking_status": _extract_smoking_status(text) or "never smoked",
        "avg_glucose_level": _extract_float(text, _GLUCOSE_PATTERN) or 95.0,
    }
    
    # Validate ranges
    extracted["age"] = max(0, min(120, extracted["age"]))
    extracted["bmi"] = max(0, min(60, extracted["bmi"]))
    extracted["avg_glucose_level"] = max(0, min(300, extracted["avg_glucose_level"]))
    
    return extracted
