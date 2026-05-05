"""
Kidney Disease prediction parser - extracts structured data from raw text/OCR.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for kidney disease fields
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_HEMO_PATTERN = re.compile(r"(?:hemoglobin|Hb|haemoglobin)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)
_SG_PATTERN = re.compile(r"(?:specific gravity|SG|urine gravity)\s*[:=]?\s*(1\.0\d{2}|1\.\d{3})", re.IGNORECASE)
_ALBUMIN_PATTERN = re.compile(r"(?:albumin|proteinuria)\s*[:=]?\s*(\d{1,2})", re.IGNORECASE)
_PCV_PATTERN = re.compile(r"(?:packed cell volume|PCV|hematocrit|Hct)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)
_CREATININE_PATTERN = re.compile(r"(?:creatinine|serum creatinine|Cr)\s*[:=]?\s*(\d{1,2}\.?\d{0,1})", re.IGNORECASE)
_HTN_PATTERN = re.compile(r"(?:hypertension|HTN|high blood pressure)\s*[:=]?\s*(yes|no|1|0)", re.IGNORECASE)


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


def parse_kidney_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from kidney disease screening and extract fields.
    Returns dict with extracted values and defaults for missing fields.
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "age": _extract_float(text, _AGE_PATTERN) or 45.0,
        "hemo": _extract_float(text, _HEMO_PATTERN) or 13.0,
        "sg": _extract_float(text, _SG_PATTERN) or 1.02,
        "al": _extract_int(text, _ALBUMIN_PATTERN) or 0,
        "pcv": _extract_float(text, _PCV_PATTERN) or 40.0,
        "sc": _extract_float(text, _CREATININE_PATTERN) or 1.0,
        "htn": _extract_binary(text, _HTN_PATTERN) or 0,
    }
    
    # Validate ranges
    extracted["age"] = max(0, min(120, extracted["age"]))
    extracted["hemo"] = max(0, min(25, extracted["hemo"]))
    extracted["sg"] = max(1.0, min(1.05, extracted["sg"]))
    extracted["al"] = max(0, min(5, extracted["al"]))
    extracted["pcv"] = max(0, min(60, extracted["pcv"]))
    extracted["sc"] = max(0, min(20, extracted["sc"]))
    extracted["htn"] = max(0, min(1, extracted["htn"]))
    
    return extracted
