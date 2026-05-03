from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.llm_schema import LLMExplanationResponse


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
PriorityLevel = Literal["LOW", "MEDIUM", "URGENT"]
ReportType = Literal["auto", "diabetes", "heart", "kidney", "stroke", "autism", "mixed"]


class GatewayAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    report_type: ReportType = "auto"
    features: Dict[str, object] = Field(default_factory=dict)
    raw_text: Optional[str] = None
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


class AnalysisInputs(BaseModel):
    report_type: ReportType
    include_explanation: bool
    symptoms: List[str] = Field(default_factory=list)
    has_image: bool = False
    has_raw_text: bool = False


class GatewayModelDetail(BaseModel):
    risk: RiskLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: str = "endpoint"
    success: bool = True
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class RiskAssessment(BaseModel):
    overall_risk: RiskLevel
    priority: PriorityLevel
    final_decision: str
    rationale: List[str] = Field(default_factory=list)


class KnowledgeGraphInsights(BaseModel):
    diseases: List[str] = Field(default_factory=list)
    symptoms: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    complications: List[str] = Field(default_factory=list)
    treatments: List[str] = Field(default_factory=list)
    connections: List[str] = Field(default_factory=list)


class UnifiedAnalysisResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: bool = True
    request_id: str
    inputs: AnalysisInputs
    extracted_features: Dict[str, Any]
    model_outputs: Dict[str, GatewayModelDetail]
    rag_context: List[str] = Field(default_factory=list)
    kg_insights: KnowledgeGraphInsights = Field(default_factory=KnowledgeGraphInsights)
    risk_assessment: RiskAssessment
    llm_explanation_text: str = ""
    final_decision: str = ""
    selected_models: List[str]
    results: Dict[str, GatewayModelResult]
    final_assessment: FinalAssessment
    reasoning: List[str]
    llm_explanation: Optional[LLMExplanationResponse] = None
    metadata: GatewayMetadata


class GatewayAnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: bool = True
    request_id: str
    inputs: AnalysisInputs
    extracted_features: Dict[str, Any]
    model_outputs: Dict[str, GatewayModelDetail]
    rag_context: List[str] = Field(default_factory=list)
    kg_insights: KnowledgeGraphInsights = Field(default_factory=KnowledgeGraphInsights)
    risk_assessment: RiskAssessment
    llm_explanation_text: str = ""
    final_decision: str = ""
    selected_models: List[str]
    results: Dict[str, GatewayModelResult]
    final_assessment: FinalAssessment
    reasoning: List[str]
    llm_explanation: Optional[LLMExplanationResponse] = None
    metadata: GatewayMetadata
