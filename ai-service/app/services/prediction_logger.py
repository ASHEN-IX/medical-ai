"""
Prediction Logging System for AIOps

Logs all predictions with features, outputs, and metadata for monitoring and drift detection.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
import numpy as np

logger = logging.getLogger(__name__)


class PredictionLogger:
    """
    Logs predictions for monitoring, audit, and drift detection.
    Stores structured logs locally or sends to backend API.
    """

    def __init__(self, backend_api_url: Optional[str] = None, enable_local_logs: bool = True):
        """
        Initialize prediction logger.

        Args:
            backend_api_url: Optional URL for backend API (e.g., http://localhost:4000)
            enable_local_logs: Whether to also write local JSON logs
        """
        self.backend_api_url = backend_api_url
        self.enable_local_logs = enable_local_logs
        self.log_file = "prediction_logs.jsonl"

    def log_prediction(
        self,
        report_id: str,
        model_id: str,
        model_version: str,
        input_features: Dict[str, Any],
        prediction: Any,
        confidence: float,
        processing_time_ms: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Log a prediction event.

        Args:
            report_id: Unique identifier for the report
            model_id: Name/ID of the model (e.g., 'diabetes_pred')
            model_version: Version of the model (e.g., '1.0')
            input_features: Input features used for prediction
            prediction: The prediction result
            confidence: Confidence score (0-1)
            processing_time_ms: Time taken for inference (ms)
            metadata: Optional additional metadata

        Returns:
            True if logging successful
        """
        try:
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "report_id": report_id,
                "model_id": model_id,
                "model_version": model_version,
                "input": self._serialize(input_features),
                "prediction": self._serialize(prediction),
                "confidence": float(confidence),
                "processing_time_ms": float(processing_time_ms),
                "metadata": metadata or {},
            }

            # Log to local file
            if self.enable_local_logs:
                self._write_local_log(log_entry)

            # Send to backend API if configured
            if self.backend_api_url:
                self._send_to_backend(log_entry)

            logger.info(
                f"Logged prediction: report_id={report_id}, model={model_id}, confidence={confidence:.2%}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to log prediction: {e}", exc_info=True)
            return False

    def _serialize(self, obj: Any) -> Any:
        """
        Serialize objects for JSON storage.
        Handles numpy types and complex objects.
        """
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.generic):
            return obj.item()
        elif isinstance(obj, dict):
            return {k: self._serialize(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._serialize(item) for item in obj]
        elif isinstance(obj, (int, float, str, bool, type(None))):
            return obj
        else:
            return str(obj)

    def _write_local_log(self, log_entry: Dict[str, Any]):
        """Write log entry to local JSONL file."""
        try:
            with open(self.log_file, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            logger.error(f"Failed to write local log: {e}")

    def _send_to_backend(self, log_entry: Dict[str, Any]):
        """Send log entry to backend API."""
        try:
            import httpx

            url = f"{self.backend_api_url}/api/logs/prediction"
            response = httpx.post(url, json=log_entry, timeout=5.0)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"Failed to send log to backend: {e}")

    def read_logs(self, limit: int = 100) -> list:
        """
        Read recent prediction logs.

        Args:
            limit: Maximum number of logs to read

        Returns:
            List of log entries
        """
        try:
            logs = []
            with open(self.log_file, "r") as f:
                for line in f:
                    if logs.__len__() >= limit:
                        break
                    logs.append(json.loads(line))
            return list(reversed(logs))  # Return most recent first
        except FileNotFoundError:
            return []
        except Exception as e:
            logger.error(f"Failed to read logs: {e}")
            return []


# Global logger instance
_logger: Optional[PredictionLogger] = None


def get_prediction_logger(
    backend_api_url: Optional[str] = None, enable_local_logs: bool = True
) -> PredictionLogger:
    """Get or create the global prediction logger instance."""
    global _logger
    if _logger is None:
        _logger = PredictionLogger(backend_api_url, enable_local_logs)
    return _logger
