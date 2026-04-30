from __future__ import annotations

import base64
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
    request_id: str


class ClassProbabilities(BaseModel):
    autism: float
    non_autism: float


class AutismDLPredictionResult(BaseModel):
    autism_detected: bool
    confidence_score: float
    class_probabilities: ClassProbabilities


class Metadata(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    processing_time_ms: int
    timestamp: datetime


class AutismDLResponse(BaseModel):
    success: bool = True
    prediction: AutismDLPredictionResult
    metadata: Metadata
    heatmap: Optional[str] = None
    request_id: str


class ImageInput(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    image: str = Field(..., description="Base64 encoded image string")
    image_format: Literal["png", "jpg", "jpeg"] = "png"
    model_version: str = "v1.0"
    return_heatmap: bool = True

    @field_validator("image")
    @classmethod
    def validate_image_base64(cls, value: str) -> str:
        payload = value
        if value.startswith("data:") and "," in value:
            payload = value.split(",", maxsplit=1)[1]

        try:
            base64.b64decode(payload, validate=True)
        except Exception as exc:  # pylint: disable=broad-except
            raise ValueError("Invalid base64-encoded image payload") from exc

        return value


class SurveyResponses(BaseModel):
    A1_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A1_Score", "A1"))
    A2_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A2_Score", "A2"))
    A3_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A3_Score", "A3"))
    A4_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A4_Score", "A4"))
    A5_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A5_Score", "A5"))
    A6_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A6_Score", "A6"))
    A7_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A7_Score", "A7"))
    A8_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A8_Score", "A8"))
    A9_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A9_Score", "A9"))
    A10_Score: int = Field(..., ge=0, le=1, validation_alias=AliasChoices("A10_Score", "A10"))


class Demographics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    gender: int | Literal["m", "f"]
    age: Optional[int] = Field(default=None, ge=0, le=120)
    ethnicity: Optional[str | int] = None
    jaundice: Optional[str | int] = None
    relation: Optional[str | int] = None

    # Optional fields from the training schema.
    austim: Optional[str | int] = None
    contry_of_res: Optional[str | int] = Field(
        default=None,
        validation_alias=AliasChoices("contry_of_res", "country_of_res"),
    )
    used_app_before: Optional[str | int] = None
    result: Optional[float] = None


class PredictionRequest(BaseModel):
    responses: SurveyResponses
    demographics: Demographics


class RiskCategories(BaseModel):
    social_communication: Literal["LOW", "MEDIUM", "HIGH"]
    repetitive_behavior: Literal["LOW", "MEDIUM", "HIGH"]
    sensory_sensitivity: Literal["LOW", "MEDIUM", "HIGH"]


class AutismPredictionResult(BaseModel):
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    autism_probability: float
    confidence_score: float
    risk_categories: RiskCategories


class PredictionResponse(BaseModel):
    success: bool = True
    prediction: AutismPredictionResult
    recommendations: List[str]
    metadata: Metadata
    request_id: str


class KidneyDiseaseRequest(BaseModel):
    age: float = Field(..., ge=0, le=120)
    hemo: float = Field(..., ge=0, le=25)
    sg: float = Field(..., ge=1.0, le=1.05)
    al: int = Field(..., ge=0, le=5)
    pcv: float = Field(..., ge=0, le=60)
    sc: float = Field(..., ge=0, le=20)
    htn: Literal[0, 1]


class KidneyClassProbabilities(BaseModel):
    ckd: float
    non_ckd: float


class KidneyDiseasePredictionResult(BaseModel):
    ckd_detected: bool
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    confidence_score: float
    ckd_probability: float
    class_probabilities: KidneyClassProbabilities


class KidneyDiseaseResponse(BaseModel):
    success: bool = True
    prediction: KidneyDiseasePredictionResult
    recommendations: List[str]
    metadata: Metadata
    request_id: str


class CategoryOption(BaseModel):
    code: int
    label: str
    display: str


class CategoryDefinition(BaseModel):
    options: List[CategoryOption]


class CategoriesResponse(BaseModel):
    success: bool = True
    categories: Dict[str, CategoryDefinition]


class ModelHealth(BaseModel):
    status: Literal["loaded", "not_loaded"]
    version: str
    response_time_ms: int


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    service: str
    version: str
    models: Dict[str, ModelHealth]
    timestamp: datetime
