"""
Thyroid Cancer prediction parser - extracts structured data from raw text/OCR.
Flexible schema to accept any thyroid clinical markers.
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Regex patterns for thyroid fields
_AGE_PATTERN = re.compile(r"(?:age|years old|y\.o\.)\s*[:=]?\s*(\d{1,3})", re.IGNORECASE)
_GENDER_PATTERN = re.compile(r"\b(male|female|m|f)\b", re.IGNORECASE)
_TUMOR_SIZE_PATTERN = re.compile(r"(?:tumor size|tumour size|size)\s*[:=]?\s*(\d{1,2}\.?\d{0,2})\s*(?:cm)?", re.IGNORECASE)
_RADIATION_PATTERN = re.compile(r"(?:radiation|radiation dose|radio iodine|RAI)\s*[:=]?\s*(\d{1,5})", re.IGNORECASE)
_STAGE_PATTERN = re.compile(r"(?:stage|TNM)\s*[:=]?\s*([1-4IViv])", re.IGNORECASE)
_HISTOLOGY_PATTERN = re.compile(r"(?:histology|histotype|cell type|carcinoma)\s*[:=]?\s*(\w+)", re.IGNORECASE)
_LYMPH_NODE_PATTERN = re.compile(r"(?:lymph node|LN|node involvement)\s*[:=]?\s*(yes|no|1|0|positive|negative)", re.IGNORECASE)
_METASTASIS_PATTERN = re.compile(r"(?:metastasis|distant metastasis|mets)\s*[:=]?\s*(yes|no|1|0|present|absent)", re.IGNORECASE)
_TSH_PATTERN = re.compile(r"(?:TSH|thyroid stimulating hormone)\s*[:=]?\s*(\d{1,3}\.?\d{0,2})", re.IGNORECASE)
_THYROGLOBULIN_PATTERN = re.compile(r"(?:thyroglobulin|Tg|tumor marker)\s*[:=]?\s*(\d{1,4}\.?\d{0,2})", re.IGNORECASE)


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


def _extract_stage(text: str) -> int | None:
    """Extract and normalize cancer stage (1-4)."""
    m = _STAGE_PATTERN.search(text)
    if m:
        val = m.group(1).upper()
        # Map roman numerals and numbers to stage number
        stage_map = {"1": 1, "2": 2, "3": 3, "4": 4, "I": 1, "II": 2, "III": 3, "IV": 4}
        return stage_map.get(val, None)
    return None


def _extract_histology(text: str) -> str | None:
    """Extract histology type."""
    m = _HISTOLOGY_PATTERN.search(text)
    if m:
        return m.group(1).capitalize()
    return None


def _extract_binary(text: str, pattern: re.Pattern) -> int | None:
    """Extract a binary (yes/no) value."""
    m = pattern.search(text)
    if m:
        val = m.group(1).lower()
        return 1 if val in {"yes", "1", "y", "positive", "present"} else 0
    return None


def parse_thyroid_request(raw_text: str) -> dict[str, Any]:
    """
    Parse raw text from thyroid cancer screening and extract fields.
    Returns dict with extracted values and sensible defaults.
    Schema allows any fields (flexible for different clinical markers).
    """
    text = raw_text.replace("\r", "\n")
    text = re.sub(r"\s+", " ", text)
    
    extracted = {
        "age": _extract_int(text, _AGE_PATTERN) or 50,
        "gender": _extract_gender(text) or "M",
        "tumor_size": _extract_float(text, _TUMOR_SIZE_PATTERN) or 2.0,
        "radiation_dose": _extract_int(text, _RADIATION_PATTERN) or 100,
        "stage": _extract_stage(text) or 1,
        "histology": _extract_histology(text) or "Papillary",
        "lymph_node_involvement": _extract_binary(text, _LYMPH_NODE_PATTERN) or 0,
        "distant_metastasis": _extract_binary(text, _METASTASIS_PATTERN) or 0,
    }
    
    # Extract optional fields
    tsh = _extract_float(text, _TSH_PATTERN)
    if tsh is not None:
        extracted["tsh_level"] = tsh
    
    thyroglobulin = _extract_float(text, _THYROGLOBULIN_PATTERN)
    if thyroglobulin is not None:
        extracted["thyroglobulin_level"] = thyroglobulin
    
    # Validate ranges
    extracted["age"] = max(1, min(120, extracted["age"]))
    extracted["tumor_size"] = max(0, min(20, extracted["tumor_size"]))
    extracted["radiation_dose"] = max(0, min(500, extracted["radiation_dose"]))
    extracted["stage"] = max(1, min(4, extracted["stage"]))
    
    return extracted
