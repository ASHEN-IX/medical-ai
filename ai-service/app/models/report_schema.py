from __future__ import annotations

from datetime import datetime
from typing import Dict

from pydantic import BaseModel, Field


FeatureValue = float | int | str | bool | None


class Metadata(BaseModel):
    processing_time_ms: int = Field(..., ge=0)
    timestamp: datetime
    extraction_method: str  # gemini, gemini_partial, fallback_regex
    extraction_attempts: int = 0


class ReportResponse(BaseModel):
    success: bool = True
    report_type: str
    features: Dict[str, FeatureValue]
    confidence_scores: Dict[str, float]
    raw_text: str
    metadata: Metadata
