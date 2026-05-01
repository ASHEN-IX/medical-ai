from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class KnowledgeGraphProfile(BaseModel):
    disease: str
    symptoms: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    complications: list[str] = Field(default_factory=list)
    treatments: list[str] = Field(default_factory=list)


class KnowledgeGraphContext(BaseModel):
    diseases: list[str] = Field(default_factory=list)
    symptoms: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    complications: list[str] = Field(default_factory=list)
    treatments: list[str] = Field(default_factory=list)
    source_profiles: list[KnowledgeGraphProfile] = Field(default_factory=list)


class KnowledgeGraphConfig(BaseModel):
    uri: str
    username: str
    password: str
    database: Optional[str] = None
