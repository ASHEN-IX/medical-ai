from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from app.models.report_schema import Metadata, ReportResponse
from app.services.gemini_extractor import GeminiExtractor
from app.utils.text_cleaner import clean_medical_text


logger = logging.getLogger(__name__)


class ReportValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class ReportService:
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

    def __init__(self, extractor: GeminiExtractor | None = None) -> None:
        self.extractor = extractor or GeminiExtractor()

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

        try:
            # GeminiExtractor handles OCR internally via PyMuPDF/Tesseract fallback
            result = self.extractor.extract(file_bytes, filename=filename)
            
            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.info(
                "Report processing completed request_id=%s disease=%s method=%s duration_ms=%s",
                request_id,
                result.disease,
                result.method,
                duration_ms
            )

            return ReportResponse(
                success=True,
                report_type=result.disease,
                features=result.data,
                confidence_scores={"overall": 1.0 if result.method == "gemini" else 0.5},
                raw_text=result.raw_text,
                metadata=Metadata(
                    processing_time_ms=duration_ms,
                    timestamp=datetime.now(timezone.utc),
                    extraction_method=result.method,
                    extraction_attempts=result.attempts
                ),
            )
        except Exception as exc:
            logger.exception("Report processing failed request_id=%s", request_id)
            raise RuntimeError(f"Report processing failed: {exc}") from exc

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
