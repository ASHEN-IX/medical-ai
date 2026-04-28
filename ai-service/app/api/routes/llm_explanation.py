from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.models.llm_schema import LLMExplainRequest, LLMExplanationResponse
from app.models.schemas import ErrorResponse
from app.services.llm_service import LLMService, LLMServiceError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["llm-explanation"])
service = LLMService()


@router.post(
    "/llm/explain",
    response_model=LLMExplanationResponse,
    responses={400: {"model": ErrorResponse}, 503: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def explain_medical_results(payload: LLMExplainRequest, request: Request) -> LLMExplanationResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        result = await service.generate_explanation(
            model_results=payload.model_results,
            features=payload.features,
            rag_context=payload.rag_context,
            request_id=request_id,
        )
        return LLMExplanationResponse.model_validate(result)
    except LLMServiceError as exc:
        logger.exception("LLM explanation failed request_id=%s", request_id)
        raise HTTPException(
            status_code=503,
            detail={
                "code": "LLM_EXPLANATION_FAILED",
                "message": "LLM explanation service failed",
                "details": str(exc),
            },
        ) from exc
