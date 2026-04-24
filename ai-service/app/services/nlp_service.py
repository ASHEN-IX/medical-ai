from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import spacy
from spacy.language import Language
from spacy.tokens import Doc

from app.utils.medical_patterns import (
    BMI_PATTERN,
    BP_PATTERN,
    CHOLESTEROL_PATTERN,
    DIABETES_MARKER_KEYWORDS,
    GLUCOSE_PATTERN,
    HEART_MARKER_KEYWORDS,
    KIDNEY_MARKER_KEYWORDS,
)
from app.utils.text_cleaner import clean_medical_text


logger = logging.getLogger(__name__)


def _load_spacy_model() -> Language:
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        logger.warning(
            "spaCy model en_core_web_sm is missing. Run: python -m spacy download en_core_web_sm"
        )
        return spacy.blank("en")


NLP_MODEL = _load_spacy_model()
_SYSTOLIC_PATTERN = re.compile(
    r"(?:systolic(?:\s*blood\s*pressure)?|sbp)\s*[:=\-]?\s*(\d{2,3})",
    re.IGNORECASE,
)


@dataclass
class NLPProcessingResult:
    report_type: str
    features: dict[str, float | int]
    confidence_scores: dict[str, float]
    cleaned_text: str


class NLPService:
    def __init__(self, nlp_model: Language | None = None) -> None:
        self.nlp = nlp_model or NLP_MODEL

    def process_text(self, text: str) -> NLPProcessingResult:
        cleaned_text = clean_medical_text(text)
        if not cleaned_text:
            return NLPProcessingResult(
                report_type="general",
                features={},
                confidence_scores={},
                cleaned_text=cleaned_text,
            )

        doc = self.nlp(cleaned_text)
        features, confidence_scores = self.extract_medical_features(cleaned_text, doc)
        report_type = self.classify_report_type(cleaned_text, features)

        return NLPProcessingResult(
            report_type=report_type,
            features=features,
            confidence_scores=confidence_scores,
            cleaned_text=cleaned_text,
        )

    def extract_medical_features(self, text: str, doc: Doc) -> tuple[dict[str, float | int], dict[str, float]]:
        features: dict[str, float | int] = {}
        confidence_scores: dict[str, float] = {}

        glucose_match = GLUCOSE_PATTERN.search(text)
        if glucose_match:
            glucose_value = self._to_float(glucose_match.group(1))
            if glucose_value is not None:
                features["glucose"] = round(glucose_value, 2)
                confidence_scores["glucose"] = self._regex_confidence(glucose_match.group(0), base=0.88)

        bp_match = BP_PATTERN.search(text)
        if bp_match:
            systolic = self._to_int(bp_match.group(1))
            diastolic = self._to_int(bp_match.group(2))
            if systolic is not None and diastolic is not None and 60 <= systolic <= 260:
                features["blood_pressure"] = systolic
                confidence_scores["blood_pressure"] = self._regex_confidence(bp_match.group(0), base=0.9)

        if "blood_pressure" not in features:
            systolic_match = _SYSTOLIC_PATTERN.search(text)
            if systolic_match:
                systolic = self._to_int(systolic_match.group(1))
                if systolic is not None and 60 <= systolic <= 260:
                    features["blood_pressure"] = systolic
                    confidence_scores["blood_pressure"] = 0.82

        cholesterol_match = CHOLESTEROL_PATTERN.search(text)
        if cholesterol_match:
            cholesterol_value = self._to_float(cholesterol_match.group(1))
            if cholesterol_value is not None:
                features["cholesterol"] = round(cholesterol_value, 2)
                confidence_scores["cholesterol"] = self._regex_confidence(
                    cholesterol_match.group(0),
                    base=0.88,
                )

        bmi_match = BMI_PATTERN.search(text)
        if bmi_match:
            bmi_value = self._to_float(bmi_match.group(1))
            if bmi_value is not None and 8 <= bmi_value <= 80:
                features["bmi"] = round(bmi_value, 2)
                confidence_scores["bmi"] = 0.9

        self._fill_missing_from_ner(text, doc, features, confidence_scores)
        return features, confidence_scores

    def classify_report_type(self, text: str, features: dict[str, float | int]) -> str:
        lowered = text.lower()

        if "glucose" in features or any(marker in lowered for marker in DIABETES_MARKER_KEYWORDS):
            return "diabetes"

        if (
            "cholesterol" in features
            or "blood_pressure" in features
            or any(marker in lowered for marker in HEART_MARKER_KEYWORDS)
        ):
            return "heart"

        if any(marker in lowered for marker in KIDNEY_MARKER_KEYWORDS):
            return "kidney"

        return "general"

    def _fill_missing_from_ner(
        self,
        text: str,
        doc: Doc,
        features: dict[str, float | int],
        confidence_scores: dict[str, float],
    ) -> None:
        if "glucose" not in features:
            glucose_value = self._extract_numeric_entity_near_keywords(
                text,
                doc,
                keywords=("glucose", "blood sugar", "fbs", "rbs"),
            )
            if glucose_value is not None:
                features["glucose"] = round(glucose_value, 2)
                confidence_scores["glucose"] = 0.65

        if "cholesterol" not in features:
            cholesterol_value = self._extract_numeric_entity_near_keywords(
                text,
                doc,
                keywords=("cholesterol", "ldl", "hdl"),
            )
            if cholesterol_value is not None:
                features["cholesterol"] = round(cholesterol_value, 2)
                confidence_scores["cholesterol"] = 0.65

        if "bmi" not in features:
            bmi_value = self._extract_numeric_entity_near_keywords(
                text,
                doc,
                keywords=("bmi", "body mass index"),
            )
            if bmi_value is not None and 8 <= bmi_value <= 80:
                features["bmi"] = round(bmi_value, 2)
                confidence_scores["bmi"] = 0.62

    def _extract_numeric_entity_near_keywords(
        self,
        text: str,
        doc: Doc,
        keywords: tuple[str, ...],
    ) -> float | None:
        for entity in doc.ents:
            if entity.label_ not in {"CARDINAL", "QUANTITY"}:
                continue

            value = self._to_float(entity.text)
            if value is None:
                continue

            start = max(0, entity.start_char - 40)
            end = min(len(text), entity.end_char + 40)
            context_window = text[start:end].lower()
            if any(keyword in context_window for keyword in keywords):
                return value

        return None

    def _to_float(self, raw_value: str) -> float | None:
        compact = raw_value.replace(",", "").strip()
        match = re.search(r"\d+(?:\.\d+)?", compact)
        if not match:
            return None

        try:
            return float(match.group(0))
        except ValueError:
            return None

    def _to_int(self, raw_value: str) -> int | None:
        parsed = self._to_float(raw_value)
        if parsed is None:
            return None
        return int(round(parsed))

    def _regex_confidence(self, matched_text: str, base: float) -> float:
        lowered = matched_text.lower()
        unit_bonus = 0.08 if "mg" in lowered or "/" in lowered else 0.0
        return min(0.99, round(base + unit_bonus, 2))
