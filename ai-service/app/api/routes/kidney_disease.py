from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import ErrorResponse, KidneyDiseaseRequest, KidneyDiseaseResponse
from app.services.kidney_disease_service import KidneyDiseaseService


router = APIRouter(tags=["kidney-disease"])
service = KidneyDiseaseService()


@router.post(
    "/kidney-disease/predict",
    response_model=KidneyDiseaseResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_kidney_disease(payload: KidneyDiseaseRequest, request: Request) -> KidneyDiseaseResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_INPUT",
                "message": "Invalid kidney disease prediction request",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MODEL_ERROR",
                "message": "Kidney model inference failed",
                "details": str(exc),
            },
        ) from exc
