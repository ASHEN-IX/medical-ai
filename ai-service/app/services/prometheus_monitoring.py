"""
Prometheus Monitoring Integration for FastAPI

Provides metrics for inference requests, latency, errors, and model performance.
"""

import logging
from typing import Callable
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, REGISTRY
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import default_handler

logger = logging.getLogger(__name__)

# Create custom metrics
registry = REGISTRY

# Request metrics
inference_requests_total = Counter(
    "inference_requests_total",
    "Total number of inference requests",
    ["model_id", "model_version"],
    registry=registry,
)

inference_latency = Histogram(
    "inference_latency_seconds",
    "Inference latency in seconds",
    ["model_id"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
    registry=registry,
)

inference_errors_total = Counter(
    "inference_errors_total",
    "Total number of inference errors",
    ["model_id", "error_type"],
    registry=registry,
)

confidence_score = Gauge(
    "prediction_confidence_avg",
    "Average confidence of predictions",
    ["model_id"],
    registry=registry,
)

model_load_errors = Counter(
    "model_load_errors_total",
    "Total model loading errors",
    ["model_id"],
    registry=registry,
)

drift_alerts_total = Counter(
    "drift_alerts_total",
    "Total drift alerts",
    ["model_id", "alert_type"],
    registry=registry,
)


def setup_prometheus(app) -> Instrumentator:
    """
    Set up Prometheus monitoring for FastAPI app.

    Args:
        app: FastAPI application instance

    Returns:
        Instrumentator instance
    """
    instrumentator = Instrumentator(
        should_group_status_codes=True,
        should_group_paths=True,
        should_respect_query_string=False,
        group_paths=True,
        excluded_handlers=["/metrics", "/health"],
    )

    instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    logger.info("Prometheus monitoring initialized")
    return instrumentator


def record_inference_request(model_id: str, model_version: str):
    """Record an inference request metric."""
    inference_requests_total.labels(model_id=model_id, model_version=model_version).inc()


def record_inference_latency(model_id: str, latency_seconds: float):
    """Record inference latency."""
    inference_latency.labels(model_id=model_id).observe(latency_seconds)


def record_inference_error(model_id: str, error_type: str):
    """Record an inference error."""
    inference_errors_total.labels(model_id=model_id, error_type=error_type).inc()


def record_confidence(model_id: str, confidence: float):
    """Record average prediction confidence."""
    confidence_score.labels(model_id=model_id).set(confidence)


def record_model_load_error(model_id: str):
    """Record a model loading error."""
    model_load_errors.labels(model_id=model_id).inc()


def record_drift_alert(model_id: str, alert_type: str):
    """Record a drift alert."""
    drift_alerts_total.labels(model_id=model_id, alert_type=alert_type).inc()
