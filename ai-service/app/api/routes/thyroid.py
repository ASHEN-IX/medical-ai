from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import ErrorResponse, ThyroidRequest, ThyroidResponse
from app.services.thyroid_service import ThyroidService


router = APIRouter(tags=["thyroid"])
service = ThyroidService()


@router.post(
    "/thyroid/predict",
    response_model=ThyroidResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_thyroid(
    payload: ThyroidRequest,
    request: Request,
) -> ThyroidResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return service.predict(payload, request_id=request_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "THYROID_PREDICTION_FAILED",
                "message": "Thyroid prediction failed",
                "details": str(exc),
            },
        ) from exc
