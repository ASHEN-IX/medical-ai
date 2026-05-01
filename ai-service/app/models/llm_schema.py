from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.knowledge_graph.kg_schema import KnowledgeGraphContext


RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class LLMExplainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_results: dict[str, Any] = Field(default_factory=dict)
    features: dict[str, Any] = Field(default_factory=dict)
    rag_context: list[str] = Field(default_factory=list)
    kg_context: KnowledgeGraphContext = Field(default_factory=KnowledgeGraphContext)


class LLMRiskInterpretation(BaseModel):
    level: RiskLevel
    meaning: str


class LLMExplanationResponse(BaseModel):
    summary: str = ""
    explanation: list[str] = Field(default_factory=list)
    risk_interpretation: LLMRiskInterpretation
    recommendations: list[str] = Field(default_factory=list)
    safety_note: str = "This does not replace medical advice."
