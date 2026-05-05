"""
Heart Disease prediction parser - extracts structured data from raw text/OCR.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for heart disease fields
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_BP_PATTERN = re.compile(r"(?:blood pressure|BP|systolic|mmHg)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_CHOLESTEROL_PATTERN = re.compile(r"(?:cholesterol|total cholesterol|serum cholesterol)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_BMI_PATTERN = re.compile(r"(?:BMI|body mass index|bmi)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)

# Risk indicators
_RISK_KEYWORDS = {
    "high": ["high blood pressure", "hypertension", "high cholesterol", "hyperlipidemia", "chest pain", "angina", "MI history", "obesity"],
    "medium": ["borderline BP", "elevated cholesterol", "overweight", "smoking", "family history heart disease"],
}


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


def parse_heart_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from heart disease screening and extract fields.
    Returns dict with extracted values and defaults for missing fields.
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "age": _extract_int(text, _AGE_PATTERN) or 45,
        "blood_pressure": _extract_float(text, _BP_PATTERN) or 120.0,
        "cholesterol": _extract_float(text, _CHOLESTEROL_PATTERN) or 200.0,
        "bmi": _extract_float(text, _BMI_PATTERN) or 25.0,
    }
    
    # Validate ranges
    extracted["age"] = max(1, min(120, extracted["age"]))
    extracted["blood_pressure"] = max(0, min(300, extracted["blood_pressure"]))
    extracted["cholesterol"] = max(0, min(600, extracted["cholesterol"]))
    extracted["bmi"] = max(10, min(60, extracted["bmi"]))
    
    return extracted
