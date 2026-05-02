from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from app.models.session_schema import (
    FetchQuestionsRequest,
    FetchQuestionsResponse,
    FinalReportRequest,
    FinalReportResponse,
    InitialAnalysisResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
)
from app.models.schemas import ErrorResponse
from app.services.report_service import ReportService, ReportValidationError
from app.services.staged_diagnosis_service import StagedDiagnosisError, StagedDiagnosisService


logger = logging.getLogger(__name__)
router = APIRouter(tags=["staged-diagnosis"])

report_service = ReportService()
staged_service = StagedDiagnosisService()


class StagedUploadParams(BaseModel):
    report_type: str = "auto"
    include_explanation: bool = True
    symptoms: List[str] = Field(default_factory=list)


class StagedAnalyzeRequest(BaseModel):
    report_type: str = "auto"
    features: Dict[str, float] = Field(default_factory=dict)
    raw_text: Optional[str] = None
    include_explanation: bool = True
    symptoms: List[str] = Field(default_factory=list)
    image: Optional[str] = None


# ---- Phase 1: Upload report -> initial analysis + questions ----

@router.post(
    "/diagnosis/upload",
    response_model=InitialAnalysisResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def staged_upload_report(
    request: Request,
    file: UploadFile = File(...),
    report_type: str = "auto",
    include_explanation: bool = True,
) -> InitialAnalysisResponse:
    """Upload a medical report, run initial analysis, and get follow-up questions if risk is above threshold."""
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        file_bytes = await file.read()
        report = await run_in_threadpool(
            report_service.process_report,
            file_bytes,
            file.filename or "uploaded_file",
            file.content_type,
            request_id,
        )

        return await staged_service.run_initial_analysis(
            report_type=report_type if report_type != "auto" else report.report_type,
            features=report.features,
            raw_text=report.raw_text,
            symptoms=[],
            include_explanation=include_explanation,
            image=None,
            request_id=request_id,
        )
    except ReportValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "INVALID_REPORT", "message": str(exc)}) from exc
    except StagedDiagnosisError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "DIAGNOSIS_ERROR", "message": str(exc)}) from exc
    except Exception as exc:
        logger.exception("Staged upload failed request_id=%s", request_id)
        raise HTTPException(status_code=500, detail={"code": "UPLOAD_FAILED", "message": str(exc)}) from exc
    finally:
        await file.close()


@router.post(
    "/diagnosis/analyze",
    response_model=InitialAnalysisResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def staged_analyze(
    payload: StagedAnalyzeRequest,
    request: Request,
) -> InitialAnalysisResponse:
    """Run initial staged analysis from pre-extracted features/text (no file upload)."""
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await staged_service.run_initial_analysis(
            report_type=payload.report_type,
            features=payload.features,
            raw_text=payload.raw_text,
            symptoms=payload.symptoms,
            include_explanation=payload.include_explanation,
            image=payload.image,
            request_id=request_id,
        )
    except StagedDiagnosisError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "DIAGNOSIS_ERROR", "message": str(exc)}) from exc
    except Exception as exc:
        logger.exception("Staged analysis failed request_id=%s", request_id)
        raise HTTPException(status_code=500, detail={"code": "ANALYSIS_FAILED", "message": str(exc)}) from exc


# ---- Fetch questions for a session ----

@router.post(
    "/diagnosis/questions",
    response_model=FetchQuestionsResponse,
    responses={404: {"model": ErrorResponse}},
)
async def fetch_follow_up_questions(
    payload: FetchQuestionsRequest,
    request: Request,
) -> FetchQuestionsResponse:
    """Fetch the follow-up questions generated for a diagnosis session."""
    try:
        return await staged_service.fetch_questions(payload.session_id)
    except StagedDiagnosisError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "SESSION_ERROR", "message": str(exc)}) from exc


# ---- Phase 2a: Submit answers ----

@router.post(
    "/diagnosis/answers",
    response_model=SubmitAnswersResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def submit_follow_up_answers(
    payload: SubmitAnswersRequest,
    request: Request,
) -> SubmitAnswersResponse:
    """Submit patient answers to follow-up questions."""
    try:
        return await staged_service.submit_answers(payload.session_id, payload.answers)
    except StagedDiagnosisError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "SESSION_ERROR", "message": str(exc)}) from exc


# ---- Phase 2b: Generate final report ----

@router.post(
    "/diagnosis/final-report",
    response_model=FinalReportResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def generate_final_report(
    payload: FinalReportRequest,
    request: Request,
) -> FinalReportResponse:
    """Generate the final enriched diagnosis report combining all evidence."""
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        return await staged_service.generate_final_report(payload.session_id, request_id=request_id)
    except StagedDiagnosisError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": "SESSION_ERROR", "message": str(exc)}) from exc
    except Exception as exc:
        logger.exception("Final report generation failed session_id=%s request_id=%s", payload.session_id, request_id)
        raise HTTPException(status_code=500, detail={"code": "REPORT_FAILED", "message": str(exc)}) from exc
