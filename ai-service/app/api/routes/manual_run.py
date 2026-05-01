from __future__ import annotations

from typing import Any, Dict, List, Mapping

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.model_orchestrator import ModelOrchestrator


router = APIRouter(tags=["ai-manual"])
orchestrator = ModelOrchestrator()


class ManualRunRequest(BaseModel):
    selected_models: List[str] = Field(..., min_items=1)
    features: Mapping[str, float] | None = None
    symptoms: List[str] | None = None
    image: str | None = None


class ManualRunResponse(BaseModel):
    success: bool = True
    results: Dict[str, Dict[str, Any]]
    details: Dict[str, Any] = Field(default_factory=dict)
    failures: Dict[str, str] = Field(default_factory=dict)


@router.post("/ai/run-model", response_model=ManualRunResponse)
async def run_models(payload: ManualRunRequest, request: Request) -> ManualRunResponse:
    request_id = getattr(request.state, "request_id", "req_manual")

    try:
        orchestration_result = await orchestrator.execute(
            selected_models=payload.selected_models,
            features=payload.features or {},
            request_id=request_id,
            symptoms=payload.symptoms,
            image_base64=payload.image,
        )
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail={"message": "Manual model run failed", "details": str(exc)}) from exc

    return ManualRunResponse(
        results=orchestration_result.results,
        details={k: getattr(v, "raw_response", {}) for k, v in orchestration_result.details.items()},
        failures=orchestration_result.failures,
    )
