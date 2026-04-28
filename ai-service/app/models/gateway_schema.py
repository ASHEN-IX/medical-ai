from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.llm_schema import LLMExplanationResponse


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
PriorityLevel = Literal["LOW", "MEDIUM", "URGENT"]
ReportType = Literal["auto", "diabetes", "heart", "stroke", "mixed"]


class GatewayAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    report_type: ReportType = "auto"
    features: Dict[str, float | int] = Field(default_factory=dict)
    include_explanation: bool = True
    symptoms: List[str] = Field(default_factory=list)
    image: Optional[str] = None


class GatewayModelResult(BaseModel):
    risk: RiskLevel
    confidence: float = Field(..., ge=0.0, le=1.0)


class FinalAssessment(BaseModel):
    overall_risk: RiskLevel
    priority: PriorityLevel


class GatewayMetadata(BaseModel):
    processing_time_ms: int = Field(..., ge=0)
    timestamp: datetime


class GatewayAnalyzeResponse(BaseModel):
    success: bool = True
    selected_models: List[str]
    results: Dict[str, GatewayModelResult]
    final_assessment: FinalAssessment
    reasoning: List[str]
    llm_explanation: Optional[LLMExplanationResponse] = None
    metadata: GatewayMetadata
