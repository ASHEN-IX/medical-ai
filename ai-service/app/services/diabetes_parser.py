"""
Diabetes Mellitus prediction parser - extracts structured data from raw text/OCR.
Handles various report formats and normalizes values to model input ranges.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for extracting diabetes-specific fields
_PREGNANCIES_PATTERN = re.compile(r"(?:pregnancies|pregnant|times pregnant|number of pregnancies|gravida)\s*[:=]?\s*(\d{1,2})", re.IGNORECASE)
_GLUCOSE_PATTERN = re.compile(r"(?:glucose|blood glucose|fasting glucose|plasma glucose)\s*[:=]?\s*(\d{1,3})\s*(?:mg/dl|mg/dL)?", re.IGNORECASE)
_BP_PATTERN = re.compile(r"(?:blood pressure|BP|systolic|diastolic)\s*[:=]?\s*(\d{1,3})(?:/(\d{1,3}))?", re.IGNORECASE)
_SKIN_THICKNESS_PATTERN = re.compile(r"(?:skin thickness|triceps|skin fold|skinfold)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_INSULIN_PATTERN = re.compile(r"(?:insulin|serum insulin|fasting insulin)\s*[:=]?\s*(\d{1,4})", re.IGNORECASE)
_BMI_PATTERN = re.compile(r"(?:BMI|body mass index|bmi)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_DPF_PATTERN = re.compile(r"(?:diabetes pedigree|pedigree function|family history score|dpf)\s*[:=]?\s*(0\.\d+|[01]\.?\d*)", re.IGNORECASE)

# Risk indicator keywords
_RISK_KEYWORDS = {
    "high": ["high glucose", "elevated glucose", "hyperglycemia", "high insulin", "obese", "BMI > 30", "gestational diabetes", "prediabetes"],
    "medium": ["borderline glucose", "slightly elevated", "overweight", "pre-diabetes", "impaired fasting"],
    "family_history": ["diabetes in family", "family history", "diabetic parent", "diabetic sibling"],
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


def _extract_bp(text: str) -> tuple[float | None, float | None]:
    """Extract systolic and diastolic blood pressure."""
    m = _BP_PATTERN.search(text)
    if m:
        try:
            systolic = float(m.group(1))
            diastolic = float(m.group(2)) if m.group(2) else None
            return systolic, diastolic
        except (ValueError, TypeError):
            pass
    
    # Try simple patterns like "160/90" format
    m = re.search(r"(\d{2,3})/(\d{2,3})", text)
    if m:
        try:
            return float(m.group(1)), float(m.group(2))
        except (ValueError, TypeError):
            pass
    
    return None, None


def _infer_risk_level(extracted: dict[str, Any]) -> str:
    """Infer risk level based on extracted values."""
    text = str(extracted).lower()
    
    high_risk_count = sum(1 for phrase in _RISK_KEYWORDS["high"] if phrase in text)
    if high_risk_count >= 2:
        return "high"
    
    medium_risk_count = sum(1 for phrase in _RISK_KEYWORDS["medium"] if phrase in text)
    if medium_risk_count >= 1 or high_risk_count >= 1:
        return "medium"
    
    return "low"


def parse_diabetes_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from diabetes screening report and extract fields.
    Returns dict with extracted values and defaults for missing fields.
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "pregnancies": _extract_int(text, _PREGNANCIES_PATTERN) or 0,
        "glucose": _extract_float(text, _GLUCOSE_PATTERN) or 100.0,
        "blood_pressure": _extract_float(text, _BP_PATTERN) or 70.0,
        "skin_thickness": _extract_float(text, _SKIN_THICKNESS_PATTERN) or 20.0,
        "insulin": _extract_float(text, _INSULIN_PATTERN) or 50.0,
        "bmi": _extract_float(text, _BMI_PATTERN) or 25.0,
        "diabetes_pedigree_function": _extract_float(text, _DPF_PATTERN) or 0.25,
        "age": _extract_int(text, _AGE_PATTERN) or 30,
    }
    
    # Validate ranges
    extracted["pregnancies"] = max(0, min(20, extracted["pregnancies"]))
    extracted["glucose"] = max(0, min(250, extracted["glucose"]))
    extracted["blood_pressure"] = max(0, min(140, extracted["blood_pressure"]))
    extracted["skin_thickness"] = max(0, min(100, extracted["skin_thickness"]))
    extracted["insulin"] = max(0, min(900, extracted["insulin"]))
    extracted["bmi"] = max(10, min(70, extracted["bmi"]))
    extracted["diabetes_pedigree_function"] = max(0, min(3, extracted["diabetes_pedigree_function"]))
    extracted["age"] = max(1, min(120, extracted["age"]))
    
    return extracted
