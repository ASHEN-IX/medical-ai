from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.models.report_schema import ReportResponse
from app.models.schemas import ErrorResponse
from app.services.report_service import ReportService, ReportValidationError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["report-processing"])
service = ReportService()


@router.post(
    "/report/process",
    response_model=ReportResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def process_medical_report(
    request: Request,
    file: UploadFile = File(...),
) -> ReportResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")

    try:
        file_bytes = await file.read()
        return await run_in_threadpool(
            service.process_report,
            file_bytes,
            file.filename or "uploaded_file",
            file.content_type,
            request_id,
        )
    except ReportValidationError as exc:
        error_code = "FILE_TOO_LARGE" if exc.status_code == 413 else "INVALID_REPORT_INPUT"
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "code": error_code,
                "message": "Report validation failed",
                "details": str(exc),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNSUPPORTED_FORMAT",
                "message": "Unsupported file format",
                "details": str(exc),
            },
        ) from exc
    except RuntimeError as exc:
        logger.exception("Report processing failed request_id=%s", request_id)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "REPORT_PROCESSING_FAILED",
                "message": "Failed to process report",
                "details": str(exc),
            },
        ) from exc
    finally:
        await file.close()
