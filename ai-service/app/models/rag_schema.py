from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field, field_validator


class MedicalKnowledgeChunkInput(BaseModel):
    id: str | None = None
    type: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)

    @field_validator("type", "text")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty")
        return cleaned

    @field_validator("id")
    @classmethod
    def strip_optional_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MedicalKnowledgeDocumentInput(BaseModel):
    disease: str = Field(..., min_length=1)
    chunks: List[MedicalKnowledgeChunkInput] = Field(..., min_length=1)

    @field_validator("disease")
    @classmethod
    def strip_disease_whitespace(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Disease cannot be empty")
        return cleaned


class MedicalRagRetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int = Field(default=3, ge=1, le=10)

    @field_validator("query")
    @classmethod
    def strip_query_whitespace(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Query cannot be empty")
        return cleaned


class MedicalRagResult(BaseModel):
    type: str
    text: str
    disease: str


class MedicalRagRetrieveResponse(BaseModel):
    results: list[MedicalRagResult]
