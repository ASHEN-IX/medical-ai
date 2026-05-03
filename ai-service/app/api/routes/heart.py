from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import HeartRequest, HeartResponse, ErrorResponse
from app.services.heart_service import HeartService


router = APIRouter(tags=["heart"])
service = HeartService()


@router.post(
    "/heart/predict",
    response_model=HeartResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_heart(payload: HeartRequest, request: Request) -> HeartResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_INPUT",
                "message": "Invalid heart prediction request",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MODEL_ERROR",
                "message": "Heart model inference failed",
                "details": str(exc),
            },
        ) from exc
