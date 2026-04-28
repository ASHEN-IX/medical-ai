from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes.autism_dl import router as autism_dl_router
from app.api.routes.autism_prediction import router as autism_prediction_router
from app.api.routes.ai_gateway import router as ai_gateway_router
from app.api.routes.llm_explanation import router as llm_explanation_router
from app.api.routes.kidney_disease import router as kidney_disease_router
from app.api.routes.rag import router as rag_router
from app.api.routes.report_processing import router as report_processing_router
from app.models.schemas import ErrorDetail, ErrorResponse, HealthResponse
from app.services.medical_rag_service import MedicalRagServiceError, medical_rag_service
from app.services.model_loader import model_loader


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting AI service and loading models...")
    model_loader.load_models()
    try:
        medical_rag_service.initialize()
    except MedicalRagServiceError as exc:
        logger.warning("Medical RAG initialization skipped at startup: %s", exc)
    logger.info(
        "Model startup loading finished | autism_dl=%s autism_pred=%s",
        "loaded" if model_loader.autism_dl_model is not None else "not_loaded",
        "loaded" if model_loader.autism_prediction_model is not None else "not_loaded",
    )
    yield


app = FastAPI(
    title="Autism Detection AI Service",
    description="Production FastAPI service for autism DL and survey prediction models.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"req_{uuid4().hex[:12]}"
    request.state.request_id = request_id

    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - started) * 1000)

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(duration_ms)

    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%s request_id=%s client_ip=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
        client_ip,
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", f"req_{uuid4().hex[:12]}")
    payload = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details=exc.errors(),
        ),
        request_id=request_id,
    )
    return JSONResponse(status_code=400, content=payload.model_dump(mode="json"))


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", f"req_{uuid4().hex[:12]}")

    if isinstance(exc.detail, dict):
        detail = exc.detail
        code = str(detail.get("code", "HTTP_ERROR"))
        message = str(detail.get("message", "Request failed"))
        details = detail.get("details")
    else:
        code = "HTTP_ERROR"
        message = str(exc.detail)
        details = None

    payload = ErrorResponse(
        success=False,
        error=ErrorDetail(code=code, message=message, details=details),
        request_id=request_id,
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", f"req_{uuid4().hex[:12]}")
    logger.exception("Unhandled exception for request_id=%s", request_id, exc_info=exc)

    payload = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred",
            details="Check service logs",
        ),
        request_id=request_id,
    )
    return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))


@app.get("/api/v1/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    health_payload = model_loader.get_health_payload()
    return HealthResponse(
        status=health_payload["status"],
        service="autism-detection-ai",
        version="1.0.0",
        models=health_payload["models"],
        timestamp=datetime.now(timezone.utc),
    )


app.include_router(autism_dl_router, prefix="/api/v1")
app.include_router(autism_prediction_router, prefix="/api/v1")
app.include_router(ai_gateway_router, prefix="/api/v1")
app.include_router(kidney_disease_router, prefix="/api/v1")
app.include_router(llm_explanation_router, prefix="/api/v1")
app.include_router(rag_router, prefix="/api/v1")
app.include_router(report_processing_router, prefix="/api/v1")
