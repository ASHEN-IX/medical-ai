from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from app.models.report_schema import Metadata, ReportResponse
from app.services.nlp_service import NLPService
from app.services.ocr_service import OCRService
from app.utils.text_cleaner import clean_medical_text


logger = logging.getLogger(__name__)


class ReportValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class ReportService:
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

    def __init__(self, ocr_service: OCRService | None = None, nlp_service: NLPService | None = None) -> None:
        self.ocr_service = ocr_service or OCRService()
        self.nlp_service = nlp_service or NLPService()

    def process_report(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str | None,
        request_id: str,
    ) -> ReportResponse:
        started = time.perf_counter()
        self._validate_file(file_bytes, filename)

        logger.info(
            "Report processing started request_id=%s filename=%s content_type=%s size_bytes=%s",
            request_id,
            filename,
            content_type,
            len(file_bytes),
        )

        file_type = self.ocr_service.detect_file_type(file_bytes, filename, content_type)
        logger.info("Detected report type=%s request_id=%s", file_type, request_id)

        if file_type == "pdf":
            ocr_result = self.ocr_service.extract_text_from_pdf(file_bytes)
        else:
            ocr_result = self.ocr_service.extract_text_from_image(file_bytes)

        if not ocr_result.text.strip():
            raise ReportValidationError("No text could be extracted from report", status_code=422)

        cleaned_text = clean_medical_text(ocr_result.text)
        if not cleaned_text:
            raise ReportValidationError("Extracted text is empty after cleaning", status_code=422)

        nlp_result = self.nlp_service.process_text(cleaned_text)

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "Report processing completed request_id=%s report_type=%s duration_ms=%s method=%s",
            request_id,
            nlp_result.report_type,
            duration_ms,
            ocr_result.extraction_method,
        )

        return ReportResponse(
            success=True,
            report_type=nlp_result.report_type,
            features=nlp_result.features,
            confidence_scores=nlp_result.confidence_scores,
            raw_text=nlp_result.cleaned_text,
            metadata=Metadata(
                processing_time_ms=duration_ms,
                timestamp=datetime.now(timezone.utc),
                extraction_method=ocr_result.extraction_method,
            ),
        )

    def _validate_file(self, file_bytes: bytes, filename: str) -> None:
        if not filename:
            raise ReportValidationError("Uploaded file must include a filename", status_code=400)

        if not file_bytes:
            raise ReportValidationError("Uploaded file is empty", status_code=400)

        if len(file_bytes) > self.MAX_FILE_SIZE_BYTES:
            raise ReportValidationError(
                f"File is too large. Maximum allowed size is {self.MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB",
                status_code=413,
            )
