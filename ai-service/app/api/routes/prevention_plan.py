"""FastAPI route for prevention plan generation."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.prevention_plan_service import prevention_plan_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["prevention-plan"])


class PreventionPlanRequest(BaseModel):
    patient: dict[str, Any] | None = None
    diagnoses: list[str] = Field(default_factory=list)
    riskFactors: list[str] = Field(default_factory=list)
    labValues: dict[str, Any] | None = None


@router.post("/prevention-plan/generate")
async def generate_prevention_plan(request: PreventionPlanRequest):
    """Generate personalized prevention plan based on patient data."""
    plan = prevention_plan_service.generate(request.model_dump())
    return plan
