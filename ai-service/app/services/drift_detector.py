"""
Drift Detection System

Detects statistical drift in input features and prediction distributions.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from collections import deque

logger = logging.getLogger(__name__)


class DriftDetector:
    """
    Detects data drift and prediction drift using statistical methods.
    """

    def __init__(
        self,
        window_size: int = 100,
        feature_threshold: float = 0.2,
        prediction_threshold: float = 0.15,
    ):
        """
        Initialize drift detector.

        Args:
            window_size: Number of recent predictions to use for comparison
            feature_threshold: Threshold for feature drift (as proportion of baseline std)
            prediction_threshold: Threshold for prediction distribution drift
        """
        self.window_size = window_size
        self.feature_threshold = feature_threshold
        self.prediction_threshold = prediction_threshold

        # Store recent feature values and predictions
        self.feature_history: Dict[str, deque] = {}
        self.prediction_history: deque = deque(maxlen=window_size)
        self.baseline: Optional[Dict[str, Any]] = None
        self.alerts: List[Dict[str, Any]] = []

    def set_baseline(self, baseline_features: Dict[str, float]):
        """
        Set baseline feature statistics (from training data).

        Args:
            baseline_features: Dict with 'mean' and 'std' for each feature
        """
        self.baseline = baseline_features
        logger.info("Baseline features set for drift detection")

    def check_feature_drift(self, features: Dict[str, float]) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if input features show drift from baseline.

        Args:
            features: Current feature dict

        Returns:
            (drift_detected, drift_report)
        """
        if self.baseline is None:
            return False, {"error": "Baseline not set"}

        drift_detected = False
        drift_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "drift_detected": False,
            "drifted_features": [],
            "statistics": {},
        }

        for feature_name, value in features.items():
            if feature_name not in self.baseline:
                continue

            baseline_mean = self.baseline[feature_name].get("mean", 0)
            baseline_std = self.baseline[feature_name].get("std", 1)

            # Compute deviation from baseline
            if baseline_std > 0:
                deviation = abs(value - baseline_mean) / baseline_std
                if deviation > self.feature_threshold:
                    drift_detected = True
                    drift_report["drifted_features"].append(
                        {
                            "feature": feature_name,
                            "current_value": value,
                            "baseline_mean": baseline_mean,
                            "deviation_sigma": deviation,
                        }
                    )

            # Store in history
            if feature_name not in self.feature_history:
                self.feature_history[feature_name] = deque(maxlen=self.window_size)
            self.feature_history[feature_name].append(value)

        drift_report["drift_detected"] = drift_detected

        if drift_detected:
            self.alerts.append(
                {
                    "type": "FEATURE_DRIFT",
                    "timestamp": drift_report["timestamp"],
                    "severity": "warning",
                    "details": drift_report,
                }
            )
            logger.warning(f"Feature drift detected: {drift_report['drifted_features']}")

        return drift_detected, drift_report

    def check_prediction_drift(self, prediction: Any) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if predictions show drift in distribution.

        Args:
            prediction: Current prediction (class label or numeric score)

        Returns:
            (drift_detected, drift_report)
        """
        self.prediction_history.append(prediction)

        if len(self.prediction_history) < self.window_size // 2:
            return False, {"error": "Insufficient history for drift detection"}

        # Simple drift check: if recent predictions differ significantly from older ones
        recent = list(self.prediction_history)[-(self.window_size // 2) :]
        older = list(self.prediction_history)[: (self.window_size // 4)]

        drift_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "drift_detected": False,
            "recent_distribution": self._compute_distribution(recent),
            "older_distribution": self._compute_distribution(older),
        }

        # For numeric predictions, check mean shift
        if isinstance(prediction, (int, float)):
            recent_mean = np.mean(recent)
            older_mean = np.mean(older)
            older_std = np.std(older) if len(older) > 1 else 1

            if older_std > 0:
                mean_shift = abs(recent_mean - older_mean) / older_std
                if mean_shift > self.prediction_threshold:
                    drift_report["drift_detected"] = True
                    drift_report["mean_shift_sigma"] = mean_shift

        # For categorical predictions, check distribution change
        elif isinstance(prediction, str):
            # Simple chi-square-like comparison
            if not self._distributions_equal(
                drift_report["recent_distribution"], drift_report["older_distribution"]
            ):
                drift_report["drift_detected"] = True

        if drift_report["drift_detected"]:
            self.alerts.append(
                {
                    "type": "PREDICTION_DRIFT",
                    "timestamp": drift_report["timestamp"],
                    "severity": "warning",
                    "details": drift_report,
                }
            )
            logger.warning(f"Prediction drift detected: {drift_report}")

        return drift_report["drift_detected"], drift_report

    def _compute_distribution(self, values: List[Any]) -> Dict[str, Any]:
        """Compute distribution statistics for values."""
        if isinstance(values[0], (int, float)):
            return {
                "mean": float(np.mean(values)),
                "std": float(np.std(values)),
                "min": float(np.min(values)),
                "max": float(np.max(values)),
            }
        else:
            # For categorical, compute counts
            unique, counts = np.unique(values, return_counts=True)
            return {
                "categories": {str(u): int(c) for u, c in zip(unique, counts)},
                "total": len(values),
            }

    def _distributions_equal(self, dist1: Dict, dist2: Dict) -> bool:
        """Simple check if two distributions are similar."""
        if "categories" in dist1 and "categories" in dist2:
            keys1 = set(dist1["categories"].keys())
            keys2 = set(dist2["categories"].keys())
            return keys1 == keys2
        return True

    def get_alerts(self, recent_only: bool = True) -> List[Dict[str, Any]]:
        """
        Get drift alerts.

        Args:
            recent_only: If True, return only recent alerts

        Returns:
            List of alert dictionaries
        """
        if recent_only:
            return self.alerts[-10:] if len(self.alerts) > 10 else self.alerts
        return self.alerts

    def clear_alerts(self):
        """Clear alert history."""
        self.alerts = []


# Global drift detector instance
_detector: Optional[DriftDetector] = None


def get_drift_detector(
    window_size: int = 100,
    feature_threshold: float = 0.2,
    prediction_threshold: float = 0.15,
) -> DriftDetector:
    """Get or create the global drift detector instance."""
    global _detector
    if _detector is None:
        _detector = DriftDetector(window_size, feature_threshold, prediction_threshold)
    return _detector
