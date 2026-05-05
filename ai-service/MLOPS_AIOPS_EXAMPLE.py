"""
Example FastAPI Integration with MLOps + AIOps

This file shows how to integrate MLflow, Prometheus, prediction logging, and drift detection
into the existing FastAPI application.

Copy relevant sections into your app/main.py
"""

import time
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

# MLOps & AIOps imports
from app.services.mlflow_tracker import get_tracker
from app.services.prediction_logger import get_prediction_logger
from app.services.drift_detector import get_drift_detector
from app.services.prometheus_monitoring import (
    setup_prometheus,
    record_inference_request,
    record_inference_latency,
    record_inference_error,
    record_confidence,
    record_drift_alert,
    record_model_load_error,
)

logger = logging.getLogger(__name__)

# ============================================================================
# EXAMPLE 1: Initialize FastAPI with Monitoring
# ============================================================================

def create_app_with_monitoring():
    """Create FastAPI app with MLOps/AIOps monitoring."""
    
    app = FastAPI(title="MedAI Nexus - with Monitoring")
    
    # Initialize MLflow tracker
    mlflow_tracker = get_tracker()
    logger.info("MLflow tracker initialized")
    
    # Initialize prediction logger
    backend_api_url = "http://backend:4000"  # Change to your backend URL
    prediction_logger = get_prediction_logger(backend_api_url=backend_api_url)
    logger.info("Prediction logger initialized")
    
    # Initialize drift detector
    drift_detector = get_drift_detector()
    
    # Set baseline features (from training data statistics)
    baseline_features = {
        "age": {"mean": 45.0, "std": 15.0},
        "glucose": {"mean": 125.0, "std": 30.0},
        "bmi": {"mean": 27.0, "std": 5.0},
        "blood_pressure": {"mean": 75.0, "std": 10.0},
        "pregnancies": {"mean": 2.0, "std": 1.5},
    }
    drift_detector.set_baseline(baseline_features)
    logger.info("Drift detector baseline set")
    
    # Setup Prometheus monitoring
    setup_prometheus(app)
    logger.info("Prometheus monitoring initialized")
    
    return app, mlflow_tracker, prediction_logger, drift_detector


# ============================================================================
# EXAMPLE 2: Prediction Endpoint with Full Monitoring
# ============================================================================

async def predict_with_monitoring(
    disease: str,
    features: dict,
    prediction_logger,
    drift_detector,
):
    """
    Example prediction function with monitoring.
    
    Args:
        disease: Disease name (diabetes, heart, kidney, etc.)
        features: Input features dict
        prediction_logger: Prediction logger instance
        drift_detector: Drift detector instance
    
    Returns:
        Prediction result with metadata
    """
    
    start_time = time.time()
    model_id = f"{disease}_pred"
    model_version = "1.0"
    request_id = f"req-{int(start_time * 1000)}"
    
    try:
        # 1. Check for feature drift
        drift_detected_features, feature_drift_report = drift_detector.check_feature_drift(
            features
        )
        
        # 2. Run model inference (placeholder)
        # In real implementation, load model and predict
        prediction = {
            "risk_level": "high" if features.get("glucose", 0) > 150 else "low",
            "probability": 0.85 if features.get("glucose", 0) > 150 else 0.15,
            "confidence": 0.92,
            "model_version": model_version,
        }
        
        # 3. Check for prediction distribution drift
        drift_detected_pred, pred_drift_report = drift_detector.check_prediction_drift(
            prediction["probability"]
        )
        
        # 4. Record Prometheus metrics
        latency_ms = (time.time() - start_time) * 1000
        record_inference_request(model_id, model_version)
        record_inference_latency(model_id, latency_ms / 1000)
        record_confidence(model_id, prediction["confidence"])
        
        # 5. Record drift alerts if detected
        if drift_detected_features or drift_detected_pred:
            record_drift_alert(model_id, "feature_drift" if drift_detected_features else "prediction_drift")
        
        # 6. Log prediction to backend
        prediction_logger.log_prediction(
            report_id=request_id,
            model_id=model_id,
            model_version=model_version,
            input_features=features,
            prediction=prediction,
            confidence=prediction["confidence"],
            processing_time_ms=latency_ms,
            metadata={
                "drift_detected_features": drift_detected_features,
                "drift_detected_prediction": drift_detected_pred,
                "feature_drift_report": feature_drift_report,
                "prediction_drift_report": pred_drift_report,
            },
        )
        
        # 7. Return prediction with monitoring info
        return {
            "success": True,
            "request_id": request_id,
            "model_id": model_id,
            "model_version": model_version,
            "prediction": prediction,
            "drift_detected": drift_detected_features or drift_detected_pred,
            "processing_time_ms": latency_ms,
            "metadata": {
                "drift_alerts": drift_detector.get_alerts(recent_only=True),
            },
        }
        
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        record_inference_error(model_id, type(e).__name__)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EXAMPLE 3: Training Integration with MLflow
# ============================================================================

async def train_and_register_model(
    disease: str,
    mlflow_tracker,
):
    """
    Example model training with MLflow tracking.
    
    Args:
        disease: Disease name
        mlflow_tracker: MLflow tracker instance
    """
    
    model_name = f"{disease}_v1"
    
    try:
        # Start MLflow run
        run_id = mlflow_tracker.start_run(
            run_name=f"train_{model_name}",
            tags={
                "project": "medai_nexus",
                "disease": disease,
                "environment": "production",
            },
        )
        
        # Log training parameters
        params = {
            "n_estimators": 100,
            "max_depth": 15,
            "min_samples_split": 5,
            "test_size": 0.2,
        }
        mlflow_tracker.log_params(params)
        
        # Log metrics (placeholder - replace with actual metrics)
        metrics = {
            "accuracy": 0.94,
            "precision": 0.92,
            "recall": 0.94,
            "f1_score": 0.93,
            "auc": 0.96,
        }
        mlflow_tracker.log_metrics(metrics)
        
        # Log model (placeholder - replace with actual model)
        # mlflow_tracker.log_model(model, "model", model_type="sklearn")
        
        # End MLflow run
        mlflow_tracker.end_run()
        
        logger.info(f"Model {model_name} training completed and logged to MLflow")
        return {"success": True, "run_id": run_id, "model_name": model_name}
        
    except Exception as e:
        logger.error(f"Training error: {e}", exc_info=True)
        mlflow_tracker.end_run()
        raise


# ============================================================================
# EXAMPLE 4: Setup Routes
# ============================================================================

def setup_monitoring_routes(app: FastAPI, prediction_logger, drift_detector):
    """Setup monitoring-related routes."""
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": "medai_ai_service"}
    
    @app.get("/metrics")
    async def get_metrics():
        """
        Metrics endpoint (exposed by prometheus_monitoring.setup_prometheus)
        """
        return {"note": "Prometheus metrics available at /metrics"}
    
    @app.get("/model/info")
    async def get_model_info(model_id: str):
        """Get model information including version and stats."""
        # This would typically call the backend API
        return {
            "model_id": model_id,
            "status": "loaded",
            "version": "1.0",
        }
    
    @app.get("/drift-status")
    async def get_drift_status():
        """Get current drift alerts."""
        alerts = drift_detector.get_alerts(recent_only=True)
        return {
            "drift_detected": len(alerts) > 0,
            "alert_count": len(alerts),
            "alerts": alerts,
        }


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    # Create app with monitoring
    app, mlflow_tracker, prediction_logger, drift_detector = create_app_with_monitoring()
    
    # Setup monitoring routes
    setup_monitoring_routes(app, prediction_logger, drift_detector)
    
    # Example: Test prediction
    @app.post("/api/predict/diabetes")
    async def predict_diabetes(features: dict):
        return await predict_with_monitoring(
            disease="diabetes",
            features=features,
            prediction_logger=prediction_logger,
            drift_detector=drift_detector,
        )
    
    # Run server
    uvicorn.run(app, host="0.0.0.0", port=8001)
