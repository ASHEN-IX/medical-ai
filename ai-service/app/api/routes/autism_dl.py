from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.schemas import AutismDLResponse, ErrorResponse, ImageInput
from app.services.autism_dl_service import AutismDLService


router = APIRouter(tags=["autism-dl"])
service = AutismDLService()


@router.post(
    "/autism-dl/predict",
    response_model=AutismDLResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_autism_dl(payload: ImageInput, request: Request) -> AutismDLResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await run_in_threadpool(service.predict, payload, request_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_IMAGE",
                "message": "Image format not supported",
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
