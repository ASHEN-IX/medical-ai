from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.models.rag_schema import MedicalRagRetrieveRequest, MedicalRagRetrieveResponse
from app.models.schemas import ErrorResponse
from app.services.medical_rag_service import (
    MedicalRagServiceError,
    MedicalRagServiceNotReadyError,
    medical_rag_service,
)


logger = logging.getLogger(__name__)

router = APIRouter(tags=["medical-rag"])
service = medical_rag_service


@router.post(
    "/rag/retrieve",
    response_model=MedicalRagRetrieveResponse,
    responses={400: {"model": ErrorResponse}, 503: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def retrieve_medical_context(
    payload: MedicalRagRetrieveRequest,
    request: Request,
) -> MedicalRagRetrieveResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        results = await run_in_threadpool(service.retrieve, payload.query, payload.top_k)
        return MedicalRagRetrieveResponse(results=results)
    except MedicalRagServiceNotReadyError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "RAG_NOT_READY",
                "message": "Medical RAG service is not ready",
                "details": str(exc),
            },
        ) from exc
    except MedicalRagServiceError as exc:
        logger.exception("Medical RAG retrieval failed request_id=%s", request_id)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RAG_RETRIEVAL_FAILED",
                "message": "Medical RAG retrieval failed",
                "details": str(exc),
            },
        ) from exc
