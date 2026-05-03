from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class SessionStage(str, Enum):
    INITIAL_ANALYSIS = "initial_analysis"
    FOLLOW_UP_PENDING = "follow_up_pending"
    ANSWERS_SUBMITTED = "answers_submitted"
    FINAL_REPORT_READY = "final_report_ready"


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class FollowUpQuestion(BaseModel):
    id: str
    text: str
    disease: str
    category: str = Field(
        ...,
        description="symptom | risk_factor | lifestyle | history | medication",
    )
    reason: str = Field(
        ...,
        description="Why this question is being asked",
    )
    answer_type: str = Field(
        default="free_text",
        description="free_text | yes_no | scale | multiple_choice",
    )
    options: List[str] = Field(default_factory=list)
    priority: int = Field(default=0, ge=0, description="Higher = more clinically valuable")
    kg_source: Optional[str] = None
    rag_source: Optional[str] = None


class PatientAnswer(BaseModel):
    question_id: str
    answer: str


class ExtractedFeature(BaseModel):
    key: str
    value: Any
    source: str = "patient_answer"
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class DiagnosisSession(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    session_id: str
    stage: SessionStage = SessionStage.INITIAL_ANALYSIS
    report_type: str = "auto"
    initial_prediction: Dict[str, Any] = Field(default_factory=dict)
    selected_disease: Optional[str] = None
    overall_risk: RiskLevel = "LOW"
    confidence: float = 0.0
    features: Dict[str, Any] = Field(default_factory=dict)
    raw_text: Optional[str] = None
    follow_up_questions: List[FollowUpQuestion] = Field(default_factory=list)
    answers: List[PatientAnswer] = Field(default_factory=list)
    enriched_features: Dict[str, Any] = Field(default_factory=dict)
    final_report: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# --- Request / Response DTOs ---

class InitialAnalysisResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: bool = True
    session_id: str
    stage: SessionStage
    report_type: str
    selected_disease: Optional[str] = None
    overall_risk: RiskLevel
    confidence: float
    model_outputs: Dict[str, Any] = Field(default_factory=dict)
    needs_follow_up: bool = False
    follow_up_questions: List[FollowUpQuestion] = Field(default_factory=list)
    reasoning: List[str] = Field(default_factory=list)
    rag_context: List[str] = Field(default_factory=list)
    kg_insights: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SubmitAnswersRequest(BaseModel):
    session_id: str
    answers: List[PatientAnswer]


class SubmitAnswersResponse(BaseModel):
    success: bool = True
    session_id: str
    stage: SessionStage
    enriched_features: Dict[str, Any] = Field(default_factory=dict)
    feature_count: int = 0


class FinalReportRequest(BaseModel):
    session_id: str


class FinalReportResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: bool = True
    session_id: str
    stage: SessionStage = SessionStage.FINAL_REPORT_READY
    report_type: str
    selected_disease: Optional[str] = None
    updated_risk: RiskLevel
    updated_confidence: float
    model_outputs: Dict[str, Any] = Field(default_factory=dict)
    rag_context: List[str] = Field(default_factory=list)
    kg_insights: Dict[str, Any] = Field(default_factory=dict)
    evidence_summary: List[str] = Field(default_factory=list)
    missing_caveats: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    llm_narrative: str = ""
    initial_vs_final: Dict[str, Any] = Field(default_factory=dict)
    safety_note: str = "This is an AI-assisted analysis and does not replace professional medical advice."
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FetchQuestionsRequest(BaseModel):
    session_id: str


class FetchQuestionsResponse(BaseModel):
    success: bool = True
    session_id: str
    stage: SessionStage
    selected_disease: Optional[str] = None
    questions: List[FollowUpQuestion] = Field(default_factory=list)
    question_count: int = 0
