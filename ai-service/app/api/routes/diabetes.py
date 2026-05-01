from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import DiabetesRequest, DiabetesResponse, ErrorResponse
from app.services.diabetes_service import DiabetesService


router = APIRouter(tags=["diabetes"])
service = DiabetesService()


@router.post(
    "/diabetes/predict",
    response_model=DiabetesResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_diabetes(payload: DiabetesRequest, request: Request) -> DiabetesResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_INPUT",
                "message": "Invalid diabetes prediction request",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MODEL_ERROR",
                "message": "Diabetes model inference failed",
                "details": str(exc),
            },
        ) from exc
