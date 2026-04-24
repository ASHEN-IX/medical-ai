from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.gateway_schema import GatewayAnalyzeRequest, GatewayAnalyzeResponse
from app.models.schemas import ErrorResponse
from app.services.gateway_service import GatewayService, GatewayValidationError


router = APIRouter(tags=["ai-gateway"])
service = GatewayService()


@router.post(
    "/ai/analyze",
    response_model=GatewayAnalyzeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def analyze_medical_data(
    payload: GatewayAnalyzeRequest,
    request: Request,
) -> GatewayAnalyzeResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await service.analyze(payload, request_id=request_id)
    except GatewayValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "code": "INVALID_GATEWAY_INPUT",
                "message": "Gateway input validation failed",
                "details": str(exc),
            },
        ) from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=500,
            detail={
                "code": "GATEWAY_PROCESSING_FAILED",
                "message": "AI Gateway analysis failed",
                "details": str(exc),
            },
        ) from exc
