"""
MLflow Model Tracking & Registry Integration

Provides centralized model tracking, logging, and registry management.
"""

import logging
import os
from typing import Any, Dict, Optional
import mlflow
import mlflow.sklearn
import mlflow.pytorch
import mlflow.pyfunc

logger = logging.getLogger(__name__)

# MLflow configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "file:./mlruns")
EXPERIMENT_NAME = "medai_models"


class MLflowTracker:
    """Centralized MLflow tracker for model versioning and logging."""

    def __init__(self):
        """Initialize MLflow tracking."""
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        mlflow.set_experiment(EXPERIMENT_NAME)
        logger.info(f"MLflow tracking URI: {MLFLOW_TRACKING_URI}")
        logger.info(f"Experiment name: {EXPERIMENT_NAME}")

    def start_run(self, run_name: str, tags: Optional[Dict[str, str]] = None) -> str:
        """
        Start a new MLflow run.

        Args:
            run_name: Name of the run
            tags: Optional tags for the run

        Returns:
            Run ID
        """
        run = mlflow.start_run(run_name=run_name)
        if tags:
            for key, value in tags.items():
                mlflow.set_tag(key, value)
        logger.info(f"Started MLflow run: {run.info.run_id}")
        return run.info.run_id

    def end_run(self):
        """End the current MLflow run."""
        mlflow.end_run()

    def log_params(self, params: Dict[str, Any]):
        """Log model parameters."""
        mlflow.log_params(params)
        logger.info(f"Logged parameters: {list(params.keys())}")

    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        """Log model metrics."""
        mlflow.log_metrics(metrics, step=step)
        logger.info(f"Logged metrics: {list(metrics.keys())}")

    def log_model(
        self,
        model: Any,
        artifact_path: str,
        model_type: str = "sklearn",
        signature: Optional[mlflow.models.ModelSignature] = None,
    ):
        """
        Log a model to MLflow.

        Args:
            model: The model to log
            artifact_path: Path to save the model
            model_type: Type of model (sklearn, pytorch, pyfunc)
            signature: Optional model signature
        """
        if model_type == "sklearn":
            mlflow.sklearn.log_model(model, artifact_path, signature=signature)
        elif model_type == "pytorch":
            mlflow.pytorch.log_model(model, artifact_path)
        logger.info(f"Logged model to {artifact_path}")

    def register_model(
        self, model_name: str, model_uri: str, stage: str = "Staging"
    ) -> Dict[str, Any]:
        """
        Register a model in MLflow model registry.

        Args:
            model_name: Name of the model
            model_uri: URI of the model artifact
            stage: Stage (Staging, Production, Archived)

        Returns:
            Model version info
        """
        version = mlflow.register_model(model_uri, model_name)
        client = mlflow.tracking.MlflowClient()
        client.transition_model_version_stage(model_name, version.version, stage)
        logger.info(f"Registered model {model_name} v{version.version} to {stage}")
        return version

    def load_production_model(self, model_name: str) -> Optional[Any]:
        """
        Load the production model from registry.

        Args:
            model_name: Name of the model

        Returns:
            Loaded model or None if not found
        """
        try:
            model_uri = f"models:/{model_name}/Production"
            model = mlflow.pyfunc.load_model(model_uri)
            logger.info(f"Loaded production model: {model_name}")
            return model
        except Exception as e:
            logger.warning(f"Failed to load production model {model_name}: {e}")
            return None

    def get_model_version_info(self, model_name: str, version: str) -> Optional[Dict]:
        """
        Get metadata of a specific model version.

        Args:
            model_name: Name of the model
            version: Version number

        Returns:
            Model version info
        """
        try:
            client = mlflow.tracking.MlflowClient()
            version_info = client.get_model_version(model_name, version)
            return {
                "name": version_info.name,
                "version": version_info.version,
                "stage": version_info.current_stage,
                "created_timestamp": version_info.creation_timestamp,
                "status": version_info.status,
            }
        except Exception as e:
            logger.error(f"Failed to get model version info: {e}")
            return None


# Global tracker instance
_tracker: Optional[MLflowTracker] = None


def get_tracker() -> MLflowTracker:
    """Get or create the global MLflow tracker instance."""
    global _tracker
    if _tracker is None:
        _tracker = MLflowTracker()
    return _tracker
