from __future__ import annotations

import logging
import importlib
import os
import pickle
import threading
import sys
from pathlib import Path
from typing import Any, Optional

from app.models.schemas import ModelHealth

try:
    import numpy as _numpy
except Exception:  # pragma: no cover - runtime dependency handling
    _numpy = None

try:
    import tensorflow as tf
except Exception:  # pragma: no cover - runtime dependency handling
    tf = None


logger = logging.getLogger(__name__)


DEFAULT_FEATURE_COLUMNS = [
    "A1_Score",
    "A2_Score",
    "A3_Score",
    "A4_Score",
    "A5_Score",
    "A6_Score",
    "A7_Score",
    "A8_Score",
    "A9_Score",
    "A10_Score",
    "age",
    "gender",
    "ethnicity",
    "jaundice",
    "austim",
    "contry_of_res",
    "used_app_before",
    "result",
    "relation",
]

DIABETES_FEATURE_COLUMNS = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]


class ModelLoader:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.project_root = Path(__file__).resolve().parents[2]
        self.models_root = Path(os.getenv("MODELS_PATH", str(self.project_root / "models")))

        self.autism_dl_model: Any | None = None
        self.autism_prediction_model: Any | None = None
        self.diabetes_model: Any | None = None
        self.diabetes_feature_columns: list[str] = DIABETES_FEATURE_COLUMNS[:]
        self.kidney_disease_model: Any | None = None
        self.kidney_scaler: Any | None = None
        self.kidney_feature_names: list[str] = []
        self.kidney_label_encoder: Any | None = None
        self.prediction_encoders: dict[str, Any] = {}
        self.feature_columns: list[str] = []

        self.model_versions = {
            "autism_dl": "v1.0",
            "autism_pred": "v2.1",
            "diabetes_pred": "v1.0",
            "kidney_pred": "v1.0",
            "stroke_pred": "v1.0",
        }
        self.model_response_times_ms = {
            "autism_dl": 0,
            "autism_pred": 0,
            "diabetes_pred": 0,
            "kidney_pred": 0,
            "stroke_pred": 0,            
        }
        self.load_errors: dict[str, str] = {}

        self._paths = {
            "autism_dl": None,
            "autism_pred": None,
            "encoders": None,
            "diabetes_model": None,
            "kidney_model": None,
            "kidney_scaler": None,
            "kidney_feature_names": None,
            "kidney_label_encoder": None,
            "stroke_model": None,
            "stroke_scaler": None,
        }

        self.stroke_model: Any | None = None
        self.stroke_scaler: Any | None = None

    def _load_pickle_like(self, path: Path) -> Any:
        self._register_numpy_compatibility()
        try:
            import joblib

            return joblib.load(path)
        except Exception:
            with path.open("rb") as file:
                return pickle.load(file)

    def _register_numpy_compatibility(self) -> None:
        if _numpy is None:
            return

        # Legacy pickles may reference the old/alternate numpy internal module paths.
        # Register aliases so unpickling can resolve the expected imports.
        core_pkg = importlib.import_module("numpy.core")
        setattr(_numpy, "_core", core_pkg)

        numpy_aliases = {
            "numpy._core": core_pkg,
            "numpy._core.multiarray": importlib.import_module("numpy.core.multiarray"),
            "numpy._core.numeric": importlib.import_module("numpy.core.numeric"),
            "numpy._core.umath": importlib.import_module("numpy.core.umath"),
            "numpy._core._multiarray_umath": importlib.import_module("numpy.core._multiarray_umath"),
        }

        for module_name, module_obj in numpy_aliases.items():
            sys.modules[module_name] = module_obj

    def _resolve_existing_path(self, candidates: list[Path]) -> Optional[Path]:
        for path in candidates:
            if path.exists():
                return path
        return None

    def _validate_artifact(self, path: Path, label: str) -> Optional[str]:
        try:
            if not path.exists():
                return f"{label} file not found: {path}"
            if not path.is_file():
                return f"{label} path is not a file: {path}"
            if path.stat().st_size <= 0:
                return f"{label} file is empty: {path}"
        except OSError as exc:
            return f"{label} file cannot be accessed: {path} ({exc})"
        return None

    def load_models(self) -> None:
        with self._lock:
            self.load_errors = {}
            self._load_autism_dl_model()
            self._load_autism_prediction_model()
            self._load_diabetes_model()
            self._load_kidney_disease_model()
            self._load_stroke_model()
            if self.load_errors:
                for model_key, reason in self.load_errors.items():
                    logger.error("Model %s is unavailable: %s", model_key, reason)
            else:
                logger.info("All configured models loaded successfully")

    def _load_diabetes_model(self) -> None:
        model_path = self._resolve_existing_path(
            [
                self.models_root / "diabetes" / "diabetes_decision_tree.joblib",
                self.models_root / "diabetes_decision_tree.joblib",
                self.project_root / "models" / "diabetes" / "diabetes_decision_tree.joblib",
                self.project_root / "legacy" / "diabetes" / "models" / "diabetes_decision_tree.joblib",
            ]
        )
        self._paths["diabetes_model"] = str(model_path) if model_path else None

        if model_path is None:
            self.diabetes_model = None
            self.diabetes_feature_columns = DIABETES_FEATURE_COLUMNS[:]
            self.load_errors["diabetes_pred"] = "Model file diabetes_decision_tree.joblib not found"
            logger.warning("Diabetes model file not found")
            return

        artifact_error = self._validate_artifact(model_path, "Diabetes model")
        if artifact_error is not None:
            self.diabetes_model = None
            self.diabetes_feature_columns = DIABETES_FEATURE_COLUMNS[:]
            self.load_errors["diabetes_pred"] = artifact_error
            logger.error(artifact_error)
            return

        try:
            self.diabetes_model = self._load_pickle_like(model_path)
            self.diabetes_feature_columns = [
                str(item) for item in getattr(self.diabetes_model, "feature_names_in_", DIABETES_FEATURE_COLUMNS)
            ]
            logger.info("Loaded diabetes decision tree model from %s", model_path)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            self.diabetes_model = None
            self.diabetes_feature_columns = DIABETES_FEATURE_COLUMNS[:]
            self.load_errors["diabetes_pred"] = f"Failed to load diabetes model: {exc}"
            logger.exception("Failed loading diabetes model from %s", model_path)

    def _load_kidney_disease_model(self) -> None:
        model_path = self._resolve_existing_path(
            [
                self.models_root / "kidney-disease" / "kidney_disease_model.pkl",
                self.project_root / "models" / "kidney-disease" / "kidney_disease_model.pkl",
                self.project_root / "legacy" / "kidney-disease" / "models" / "kidney_disease_model.pkl",
            ]
        )
        scaler_path = self._resolve_existing_path(
            [
                self.models_root / "kidney-disease" / "scaler.pkl",
                self.project_root / "models" / "kidney-disease" / "scaler.pkl",
                self.project_root / "legacy" / "kidney-disease" / "models" / "scaler.pkl",
            ]
        )
        feature_names_path = self._resolve_existing_path(
            [
                self.models_root / "kidney-disease" / "feature_names.pkl",
                self.project_root / "models" / "kidney-disease" / "feature_names.pkl",
                self.project_root / "legacy" / "kidney-disease" / "models" / "feature_names.pkl",
            ]
        )
        label_encoder_path = self._resolve_existing_path(
            [
                self.models_root / "kidney-disease" / "label_encoder.pkl",
                self.project_root / "models" / "kidney-disease" / "label_encoder.pkl",
                self.project_root / "legacy" / "kidney-disease" / "models" / "label_encoder.pkl",
            ]
        )

        self._paths["kidney_model"] = str(model_path) if model_path else None
        self._paths["kidney_scaler"] = str(scaler_path) if scaler_path else None
        self._paths["kidney_feature_names"] = str(feature_names_path) if feature_names_path else None
        self._paths["kidney_label_encoder"] = str(label_encoder_path) if label_encoder_path else None

        required_artifacts = {
            "kidney model": model_path,
            "kidney scaler": scaler_path,
            "kidney feature names": feature_names_path,
            "kidney label encoder": label_encoder_path,
        }

        for label, path in required_artifacts.items():
            if path is None:
                self.kidney_disease_model = None
                self.kidney_scaler = None
                self.kidney_feature_names = []
                self.kidney_label_encoder = None
                self.load_errors["kidney_pred"] = (
                    "Kidney disease artifacts not found (expected under /models/kidney-disease or legacy fallback)"
                )
                logger.warning("%s file not found", label)
                return

            artifact_error = self._validate_artifact(path, label)
            if artifact_error is not None:
                self.kidney_disease_model = None
                self.kidney_scaler = None
                self.kidney_feature_names = []
                self.kidney_label_encoder = None
                self.load_errors["kidney_pred"] = artifact_error
                logger.error(artifact_error)
                return

        try:
            self.kidney_disease_model = self._load_pickle_like(model_path)
            self.kidney_scaler = self._load_pickle_like(scaler_path)
            raw_feature_names = self._load_pickle_like(feature_names_path)
            self.kidney_feature_names = [str(item) for item in raw_feature_names] if raw_feature_names is not None else []
            self.kidney_label_encoder = self._load_pickle_like(label_encoder_path)
            logger.info("Loaded kidney disease model artifacts from %s", model_path.parent)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            self.kidney_disease_model = None
            self.kidney_scaler = None
            self.kidney_feature_names = []
            self.kidney_label_encoder = None
            self.load_errors["kidney_pred"] = f"Failed to load kidney disease artifacts: {exc}"
            logger.exception("Failed loading kidney disease artifacts")

    def _load_autism_dl_model(self) -> None:
        model_path = self._resolve_existing_path(
            [
                self.models_root / "autism-dl" / "autism-dl.h5",
                self.models_root / "autism-dl" / "final_model.h5",
                self.models_root / "autism-dl.h5",
                self.models_root / "final_model.h5",
                self.project_root / "models" / "autism-dl" / "autism-dl.h5",
                self.project_root / "models" / "autism-dl" / "final_model.h5",
                self.project_root / "legacy" / "gradio" / "autism-dl" / "autism-dl.h5",
                self.project_root / "legacy" / "gradio" / "autism-dl" / "final_model.h5",
            ]
        )
        self._paths["autism_dl"] = str(model_path) if model_path else None

        if model_path is None:
            self.autism_dl_model = None
            self.load_errors["autism_dl"] = "Model file autism-dl.h5/final_model.h5 not found"
            logger.warning("Autism DL model file not found")
            return

        artifact_error = self._validate_artifact(model_path, "Autism DL model")
        if artifact_error is not None:
            self.autism_dl_model = None
            self.load_errors["autism_dl"] = artifact_error
            logger.error(artifact_error)
            return

        if tf is None:
            self.autism_dl_model = None
            self.load_errors["autism_dl"] = "TensorFlow dependency not available"
            logger.error("TensorFlow is not available; cannot load DL model")
            return

        try:
            self.autism_dl_model = tf.keras.models.load_model(model_path, compile=False)
            logger.info("Loaded autism DL model from %s", model_path)
            return
        except Exception as exc:
            logger.warning("Standard model load failed: %s", exc)

        try:
            self.autism_dl_model = tf.keras.models.load_model(  # type: ignore[arg-type]
                model_path,
                safe_mode=False,
                compile=False,
            )
            logger.info("Loaded autism DL model (safe_mode=False) from %s", model_path)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            self.autism_dl_model = None
            self.load_errors["autism_dl"] = f"Failed to load model: {exc}"
            logger.exception("Failed to load autism DL model from %s", model_path)

    def _load_autism_prediction_model(self) -> None:
        model_path = self._resolve_existing_path(
            [
                self.models_root / "autism-prediction" / "best-model-autism.pkl",
                self.models_root / "autism-prediction" / "best_model.pkl",
                self.models_root / "best-model-autism.pkl",
                self.models_root / "best_model.pkl",
                self.project_root / "models" / "autism-prediction" / "best-model-autism.pkl",
                self.project_root / "models" / "autism-prediction" / "best_model.pkl",
                self.project_root / "legacy" / "gradio" / "autism-prediction" / "models" / "best-model-autism.pkl",
                self.project_root / "legacy" / "gradio" / "autism-prediction" / "models" / "best_model.pkl",
            ]
        )
        self._paths["autism_pred"] = str(model_path) if model_path else None

        if model_path is None:
            self.autism_prediction_model = None
            self.feature_columns = DEFAULT_FEATURE_COLUMNS[:]
            self.load_errors["autism_pred"] = "Model file best-model-autism.pkl/best_model.pkl not found"
            logger.warning("Autism prediction model file not found")
            return

        artifact_error = self._validate_artifact(model_path, "Autism prediction model")
        if artifact_error is not None:
            self.autism_prediction_model = None
            self.feature_columns = DEFAULT_FEATURE_COLUMNS[:]
            self.load_errors["autism_pred"] = artifact_error
            logger.error(artifact_error)
            return

        try:
            self.autism_prediction_model = self._load_pickle_like(model_path)
            self.feature_columns = list(
                getattr(self.autism_prediction_model, "feature_names_in_", DEFAULT_FEATURE_COLUMNS)
            )
            logger.info("Loaded autism prediction model from %s", model_path)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            self.autism_prediction_model = None
            self.feature_columns = DEFAULT_FEATURE_COLUMNS[:]
            self.load_errors["autism_pred"] = f"Failed to load model: {exc}"
            logger.exception("Failed to load autism prediction model from %s", model_path)

        encoders_path = self._resolve_existing_path(
            [
                self.models_root / "autism-prediction" / "encoders.pkl",
                self.models_root / "encoders.pkl",
                self.project_root / "models" / "autism-prediction" / "encoders.pkl",
                self.project_root / "legacy" / "gradio" / "autism-prediction" / "models" / "encoders.pkl",
            ]
        )
        self._paths["encoders"] = str(encoders_path) if encoders_path else None

        if encoders_path is None:
            self.prediction_encoders = {}
            logger.warning("Encoder file not found; using fallback category mappings")
            return

        encoders_error = self._validate_artifact(encoders_path, "Prediction encoders")
        if encoders_error is not None:
            self.prediction_encoders = {}
            logger.warning("%s; using fallback category mappings", encoders_error)
            return

        try:
            encoders = self._load_pickle_like(encoders_path)
            if isinstance(encoders, dict):
                self.prediction_encoders = encoders
            else:
                self.prediction_encoders = {}
                logger.warning("Unsupported encoders format in %s", encoders_path)
            logger.info("Loaded category encoders from %s", encoders_path)
        except Exception as exc:  # pragma: no cover - runtime dependency behavior
            self.prediction_encoders = {}
            logger.exception("Failed to load encoders from %s: %s", encoders_path, exc)

    def _load_stroke_model(self) -> None:
        model_path = self._resolve_existing_path(
            [
                self.models_root / "Stroke_prediction" / "stroke_model.pkl",
                self.models_root / "stroke-prediction" / "stroke_model.pkl",
                self.project_root / "models" / "Stroke_prediction" / "stroke_model.pkl",
                self.project_root / "models" / "stroke-prediction" / "stroke_model.pkl",
            ]
        )
        self._paths["stroke_model"] = str(model_path) if model_path else None

        if model_path is None:
            self.stroke_model = None
            self.stroke_scaler = None
            self.load_errors["stroke_pred"] = "Stroke model file not found"
            logger.warning("Stroke model file not found")
            return

        artifact_error = self._validate_artifact(model_path, "Stroke model")
        if artifact_error is not None:
            self.stroke_model = None
            self.stroke_scaler = None
            self.load_errors["stroke_pred"] = artifact_error
            logger.error(artifact_error)
            return

        try:
            loaded = self._load_pickle_like(model_path)
            
            # Handle both dict format (model + scaler) and single model format
            if isinstance(loaded, dict):
                self.stroke_model = loaded.get("model")
                self.stroke_scaler = loaded.get("scaler")
            else:
                self.stroke_model = loaded
                self.stroke_scaler = None
                
            logger.info("Loaded stroke model from %s", model_path)
        except Exception as exc:
            self.stroke_model = None
            self.stroke_scaler = None
            self.load_errors["stroke_pred"] = f"Failed to load stroke model: {exc}"
            logger.exception("Failed to load stroke model from %s", model_path)

    def record_response_time(self, model_key: str, duration_ms: int) -> None:
        if model_key in self.model_response_times_ms:
            self.model_response_times_ms[model_key] = max(0, int(duration_ms))

    def get_health_payload(self) -> dict[str, Any]:
        dl_loaded = self.autism_dl_model is not None
        pred_loaded = self.autism_prediction_model is not None
        diabetes_loaded = self.diabetes_model is not None
        kidney_loaded = self.kidney_disease_model is not None and self.kidney_scaler is not None
        stroke_loaded = self.stroke_model is not None

        return {
            "status": "healthy" if dl_loaded and pred_loaded and stroke_loaded else "degraded",
            "models": {
                "autism_dl": ModelHealth(
                    status="loaded" if dl_loaded else "not_loaded",
                    version=self.model_versions["autism_dl"],
                    response_time_ms=self.model_response_times_ms["autism_dl"],
                ),
                "autism_pred": ModelHealth(
                    status="loaded" if pred_loaded else "not_loaded",
                    version=self.model_versions["autism_pred"],
                    response_time_ms=self.model_response_times_ms["autism_pred"],
                ),
                "diabetes_pred": ModelHealth(
                    status="loaded" if diabetes_loaded else "not_loaded",
                    version=self.model_versions["diabetes_pred"],
                    response_time_ms=self.model_response_times_ms["diabetes_pred"],
                ),
                "kidney_pred": ModelHealth(
                    status="loaded" if kidney_loaded else "not_loaded",
                    version=self.model_versions["kidney_pred"],
                    response_time_ms=self.model_response_times_ms["kidney_pred"],
                ),
                "stroke_pred": ModelHealth(
                    status="loaded" if stroke_loaded else "not_loaded",
                    version=self.model_versions["stroke_pred"],
                    response_time_ms=self.model_response_times_ms["stroke_pred"],
                ),
            },
        }


model_loader = ModelLoader()
