"""
Liver Disease prediction parser - extracts structured data from raw text/OCR.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for liver disease fields
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_GENDER_PATTERN = re.compile(r"\b(male|female|m|f)\b", re.IGNORECASE)
_BILIRUBIN_PATTERN = re.compile(r"(?:total bilirubin|bilirubin)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})", re.IGNORECASE)
_DIRECT_BILI_PATTERN = re.compile(r"(?:direct bilirubin|conjugated bilirubin)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})", re.IGNORECASE)
_ALP_PATTERN = re.compile(r"(?:alkaline phosphatase|ALP|alkaline phos)\s*[:=]?\s*(\d{1,4})", re.IGNORECASE)
_ALT_PATTERN = re.compile(r"(?:alanine aminotransferase|ALT|SGPT)\s*[:=]?\s*(\d{1,4})", re.IGNORECASE)
_AST_PATTERN = re.compile(r"(?:aspartate aminotransferase|AST|SGOT)\s*[:=]?\s*(\d{1,4})", re.IGNORECASE)
_ALBUMIN_PATTERN = re.compile(r"(?:albumin)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})", re.IGNORECASE)
_PROTEIN_PATTERN = re.compile(r"(?:total protein|total proteins)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})", re.IGNORECASE)
_AG_RATIO_PATTERN = re.compile(r"(?:albumin.*globulin|A/G ratio)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})", re.IGNORECASE)


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


def _extract_gender(text: str) -> str | None:
    """Extract and normalize gender."""
    m = _GENDER_PATTERN.search(text)
    if not m:
        return None
    val = m.group(1).lower()
    return "M" if val.startswith("m") else "F"


def parse_liver_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from liver disease screening and extract fields.
    Returns dict with extracted values and defaults for missing fields.
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "age": _extract_int(text, _AGE_PATTERN) or 45,
        "gender": _extract_gender(text) or "M",
        "total_bilirubin": _extract_float(text, _BILIRUBIN_PATTERN) or 0.7,
        "direct_bilirubin": _extract_float(text, _DIRECT_BILI_PATTERN) or 0.2,
        "alkaline_phosphotase": _extract_float(text, _ALP_PATTERN) or 64.0,
        "alanine_aminotransferase": _extract_float(text, _ALT_PATTERN) or 33.0,
        "aspartate_aminotransferase": _extract_float(text, _AST_PATTERN) or 32.0,
        "total_protiens": _extract_float(text, _PROTEIN_PATTERN) or 7.5,
        "albumin": _extract_float(text, _ALBUMIN_PATTERN) or 4.5,
        "albumin_and_globulin_ratio": _extract_float(text, _AG_RATIO_PATTERN) or 1.2,
    }
    
    # Validate ranges
    extracted["age"] = max(1, min(120, extracted["age"]))
    extracted["total_bilirubin"] = max(0, min(30, extracted["total_bilirubin"]))
    extracted["direct_bilirubin"] = max(0, min(20, extracted["direct_bilirubin"]))
    extracted["alkaline_phosphotase"] = max(0, min(1500, extracted["alkaline_phosphotase"]))
    extracted["alanine_aminotransferase"] = max(0, min(2000, extracted["alanine_aminotransferase"]))
    extracted["aspartate_aminotransferase"] = max(0, min(5000, extracted["aspartate_aminotransferase"]))
    extracted["total_protiens"] = max(0, min(10, extracted["total_protiens"]))
    extracted["albumin"] = max(0, min(6, extracted["albumin"]))
    extracted["albumin_and_globulin_ratio"] = max(0, min(3, extracted["albumin_and_globulin_ratio"]))
    
    return extracted
