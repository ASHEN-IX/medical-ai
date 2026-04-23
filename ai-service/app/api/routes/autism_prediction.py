from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import CategoriesResponse, ErrorResponse, PredictionRequest, PredictionResponse
from app.services.autism_prediction_service import AutismPredictionService


router = APIRouter(tags=["autism-prediction"])
service = AutismPredictionService()


@router.post(
    "/autism-pred/predict",
    response_model=PredictionResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_autism(payload: PredictionRequest, request: Request) -> PredictionResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_INPUT",
                "message": "Invalid prediction request",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MODEL_ERROR",
                "message": "Model inference failed",
                "details": str(exc),
            },
        ) from exc


@router.get("/autism-pred/categories", response_model=CategoriesResponse)
async def get_prediction_categories() -> CategoriesResponse:
    return await run_in_threadpool(service.get_categories)
