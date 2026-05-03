from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import LiverRequest, LiverResponse, ErrorResponse
from app.services.liver_service import LiverService


router = APIRouter(tags=["liver"])
service = LiverService()


@router.post(
    "/liver-disease/predict",
    response_model=LiverResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_liver(payload: LiverRequest, request: Request) -> LiverResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_INPUT",
                "message": "Invalid liver prediction request",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MODEL_ERROR",
                "message": "Liver model inference failed",
                "details": str(exc),
            },
        ) from exc
