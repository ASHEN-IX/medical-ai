from __future__ import annotations

import re


_NON_PRINTABLE_RE = re.compile(r"[^\x09\x0A\x0D\x20-\x7E]")
_WHITESPACE_RE = re.compile(r"\s+")


def clean_medical_text(text: str) -> str:
    """Normalize OCR/NLP text into a compact single-line representation."""
    if not text:
        return ""

    normalized = text.replace("\x0c", " ").replace("\u00a0", " ")
    normalized = normalized.replace("|", " ")
    normalized = _NON_PRINTABLE_RE.sub(" ", normalized)
    normalized = _WHITESPACE_RE.sub(" ", normalized)
    return normalized.strip()
