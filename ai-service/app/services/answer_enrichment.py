from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

from app.models.session_schema import ExtractedFeature, FollowUpQuestion, PatientAnswer

logger = logging.getLogger(__name__)

YES_SYNONYMS = {"yes", "yeah", "yep", "y", "true", "definitely", "absolutely", "indeed", "correct", "sure"}
NO_SYNONYMS = {"no", "nope", "n", "false", "never", "not", "none"}

CATEGORY_TO_FEATURE_PREFIX = {
    "symptom": "symptom",
    "risk_factor": "risk",
    "lifestyle": "lifestyle",
    "history": "history",
    "medication": "medication",
}

LIFESTYLE_EXTRACTORS: Dict[str, callable] = {}

ACTIVITY_LEVELS = {
    "sedentary": 0.0,
    "lightly active": 0.25,
    "moderately active": 0.5,
    "very active": 1.0,
}

DIET_LEVELS = {
    "high in processed/sugary foods": 0.0,
    "balanced": 0.5,
    "primarily whole foods": 1.0,
}


class AnswerEnrichmentService:
    """Converts free-text patient answers into normalized, structured features
    that can be fed back into the second-stage diagnosis pipeline."""

    def enrich(
        self,
        questions: List[FollowUpQuestion],
        answers: List[PatientAnswer],
    ) -> Dict[str, Any]:
        question_map = {q.id: q for q in questions}
        features: Dict[str, Any] = {}

        for answer in answers:
            question = question_map.get(answer.question_id)
            if question is None:
                logger.warning("Answer for unknown question_id=%s", answer.question_id)
                continue

            extracted = self._extract_features(question, answer.answer)
            for feat in extracted:
                features[feat.key] = feat.value

        return features

    def _extract_features(self, question: FollowUpQuestion, answer_text: str) -> List[ExtractedFeature]:
        cleaned = answer_text.strip()
        if not cleaned:
            return []

        extracted: List[ExtractedFeature] = []
        prefix = CATEGORY_TO_FEATURE_PREFIX.get(question.category, question.category)
        topic = self._topic_from_question(question)

        if question.answer_type == "yes_no" or self._is_yes_no(cleaned):
            value = self._parse_yes_no(cleaned)
            if value is not None:
                extracted.append(ExtractedFeature(
                    key=f"{prefix}_{topic}",
                    value=1.0 if value else 0.0,
                    source="patient_answer",
                    confidence=0.9,
                ))
                return extracted

        if question.answer_type == "multiple_choice" and question.options:
            matched_option = self._match_option(cleaned, question.options)
            if matched_option is not None:
                extracted.append(ExtractedFeature(
                    key=f"{prefix}_{topic}",
                    value=matched_option,
                    source="patient_answer",
                    confidence=0.85,
                ))
                scale_val = self._option_to_scale(matched_option, question)
                if scale_val is not None:
                    extracted.append(ExtractedFeature(
                        key=f"{prefix}_{topic}_scale",
                        value=scale_val,
                        source="patient_answer",
                        confidence=0.8,
                    ))
                return extracted

        specific = self._extract_specific(question, cleaned, prefix, topic)
        if specific:
            return specific

        extracted.append(ExtractedFeature(
            key=f"{prefix}_{topic}_text",
            value=cleaned,
            source="patient_answer",
            confidence=0.7,
        ))

        severity = self._infer_severity(cleaned)
        if severity is not None:
            extracted.append(ExtractedFeature(
                key=f"{prefix}_{topic}_severity",
                value=severity,
                source="inferred",
                confidence=0.6,
            ))

        return extracted

    def _extract_specific(
        self,
        question: FollowUpQuestion,
        text: str,
        prefix: str,
        topic: str,
    ) -> List[ExtractedFeature]:
        lower = text.lower()
        extracted: List[ExtractedFeature] = []

        if "smok" in lower:
            if any(w in lower for w in {"quit", "used to", "stopped", "former"}):
                extracted.append(ExtractedFeature(key="smoking_status", value="former", confidence=0.85))
            elif self._is_affirmative(lower):
                extracted.append(ExtractedFeature(key="smoking_status", value="current", confidence=0.85))
            elif self._is_negative(lower):
                extracted.append(ExtractedFeature(key="smoking_status", value="never", confidence=0.85))

        if "drink" in lower or "alcohol" in lower:
            num = self._extract_number(lower)
            if num is not None:
                extracted.append(ExtractedFeature(key="alcohol_drinks_per_week", value=num, confidence=0.75))
            if any(w in lower for w in {"daily", "every day", "every night", "most evening", "most night"}):
                extracted.append(ExtractedFeature(key="alcohol_frequency", value="daily", confidence=0.8))
            elif any(w in lower for w in {"weekly", "few times", "weekends"}):
                extracted.append(ExtractedFeature(key="alcohol_frequency", value="weekly", confidence=0.8))
            elif any(w in lower for w in {"rarely", "occasional", "socially"}):
                extracted.append(ExtractedFeature(key="alcohol_frequency", value="occasional", confidence=0.8))
            elif self._is_negative(lower):
                extracted.append(ExtractedFeature(key="alcohol_frequency", value="never", confidence=0.85))

        if "breath" in lower or "stair" in lower or "exertion" in lower:
            extracted.append(ExtractedFeature(
                key="symptom_exertional_dyspnea",
                value=1.0 if self._is_affirmative(lower) else 0.0,
                confidence=0.8,
            ))

        if "swell" in lower or "edema" in lower:
            extracted.append(ExtractedFeature(key="symptom_edema", value=1.0, confidence=0.8))

        if "blood" in lower and "urine" in lower:
            extracted.append(ExtractedFeature(key="symptom_hematuria", value=1.0, confidence=0.8))

        if "foam" in lower and "urine" in lower:
            extracted.append(ExtractedFeature(key="symptom_proteinuria", value=1.0, confidence=0.75))

        if "yellow" in lower and ("skin" in lower or "eye" in lower):
            extracted.append(ExtractedFeature(key="symptom_jaundice", value=1.0, confidence=0.85))

        return extracted

    def _topic_from_question(self, question: FollowUpQuestion) -> str:
        if question.kg_source:
            return re.sub(r"[^a-z0-9]+", "_", question.kg_source.lower()).strip("_")
        words = re.sub(r"[^a-z0-9\s]+", "", question.text.lower()).split()
        stop = {"do", "you", "have", "has", "are", "is", "a", "an", "the", "or", "and", "in", "of", "any", "your", "been"}
        content = [w for w in words if w not in stop][:4]
        return "_".join(content) if content else "general"

    def _is_yes_no(self, text: str) -> bool:
        first_word = text.lower().split()[0] if text.split() else ""
        return first_word in YES_SYNONYMS or first_word in NO_SYNONYMS

    def _parse_yes_no(self, text: str) -> bool | None:
        first_word = text.lower().split()[0] if text.split() else ""
        if first_word in YES_SYNONYMS or self._is_affirmative(text.lower()):
            return True
        if first_word in NO_SYNONYMS or self._is_negative(text.lower()):
            return False
        return None

    def _is_affirmative(self, lower: str) -> bool:
        return any(w in lower.split() for w in YES_SYNONYMS)

    def _is_negative(self, lower: str) -> bool:
        return any(w in lower.split() for w in NO_SYNONYMS)

    def _match_option(self, text: str, options: List[str]) -> str | None:
        lower = text.lower().strip()
        for opt in options:
            if opt.lower() == lower:
                return opt
        for opt in options:
            if opt.lower() in lower or lower in opt.lower():
                return opt
        return None

    def _option_to_scale(self, option: str, question: FollowUpQuestion) -> float | None:
        lower = option.lower()
        if lower in ACTIVITY_LEVELS:
            return ACTIVITY_LEVELS[lower]
        if lower in DIET_LEVELS:
            return DIET_LEVELS[lower]
        if question.options:
            try:
                idx = [o.lower() for o in question.options].index(lower)
                return idx / max(1, len(question.options) - 1)
            except ValueError:
                return None
        return None

    def _extract_number(self, text: str) -> float | None:
        match = re.search(r"(\d+(?:\.\d+)?)", text)
        if match:
            return float(match.group(1))
        return None

    def _infer_severity(self, text: str) -> float | None:
        lower = text.lower()
        if any(w in lower for w in {"severe", "extreme", "constant", "always", "very bad", "unbearable"}):
            return 1.0
        if any(w in lower for w in {"moderate", "sometimes", "occasional", "fairly", "often"}):
            return 0.6
        if any(w in lower for w in {"mild", "slight", "rarely", "minor", "a little"}):
            return 0.3
        return None
