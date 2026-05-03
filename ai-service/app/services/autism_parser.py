from __future__ import annotations

import re
import logging
from typing import Any

from app.models.schemas import PredictionRequest, SurveyResponses, Demographics

logger = logging.getLogger(__name__)


_A_SCORE_PATTERN = re.compile(r"\bA(\d{1,2})[_\s:-]*\s*(?:Score)?\s*[:=]?\s*([01])\b", re.IGNORECASE)
_A_SCORE_ALT_PATTERN = re.compile(r"\bA(\d{1,2})\b\s*[\-\)]?\s*[:\)]?\s*(yes|no|1|0)\b", re.IGNORECASE)
_A_ITEM_PATTERN = re.compile(r"\bA(\d{1,2})\b", re.IGNORECASE)
# Pattern for M-CHAT format where A# is directly followed by question text then Yes/No response
_A_MCHAT_PATTERN = re.compile(r"\bA(\d{1,2})\s*(?:Does|Is|Can|Do|Did)\b.{1,200}?\b(Yes|No)\b", re.IGNORECASE | re.DOTALL)
_A_MCHAT_LOOSE = re.compile(r"\bA(\d{1,2})\b.{1,300}?\b(Yes|No)\b", re.IGNORECASE | re.DOTALL)

# More flexible age pattern to handle "Age / Gender7 years" or "Age: 7 years" or just "Age 7"
_AGE_PATTERN = re.compile(r"(?:Age|age)[^\w\d]*(\d{1,3})\s*(?:years|yrs|y\.o\.)?", re.IGNORECASE)
_GENDER_PATTERN = re.compile(r"\b(male|female|m|f)\b", re.IGNORECASE)
_YES_NO_PATTERN = re.compile(r"\b(yes|no|y|n)\b", re.IGNORECASE)
_LABELED_FIELD_PATTERN = re.compile(
    r"(?P<label>Ethnicity|Jaundice at Birth|Prior Screening App|Used App Before|Country of Residence|Relation|Informant)\s*[:/\-]?\s*(?P<value>[A-Za-z0-9 \-_/]+)",
    re.IGNORECASE,
)

# Ethnicity keywords mapping - using simpler labels that match training data
_ETHNICITY_KEYWORDS = {
    "white": "0",  # Use indices to match potential encoder
    "european": "0",
    "caucasian": "0",
    "asian": "1",
    "middle eastern": "2",
    "middle-eastern": "2",
    "black": "3",
    "african": "3",
    "hispanic": "4",
    "latin": "4",
}

# Relation keywords - map to numeric values that match model encoders
_RELATION_KEYWORDS = {
    "self": "0",
    "parent": "1",
    "mother": "1",
    "father": "1",
    "sibling": "2",
    "brother": "2",
    "sister": "2",
    "relative": "2",
    "grandparent": "2",
    "healthcare": "3",
    "health care": "3",
    "professional": "3",
    "doctor": "3",
    "clinician": "3",
}

# Clinical indicator patterns for inferring A-scores from unstructured text
_BEHAVIORAL_INDICATORS = {
    # Social communication indicators (A1-A5)
    "social": ["social", "communication", "interact", "share", "response", "reciprocal"],
    # Repetitive behavior indicators (A6-A8)
    "repetitive": ["repetitive", "stereotyped", "rigid", "pattern", "routine", "circumscribed"],
    # Sensory indicators (A9-A10)
    "sensory": ["sensory", "sensory sensitivity", "sensory sensit", "sound", "light", "touch", "propriocept", "vestibular"],
}


def _extract_binary_answers(text: str) -> dict[str, int]:
    answers: dict[str, int] = {}

    # Basic preprocessing to normalize common OCR artifacts and whitespace
    text = text.replace("\r", "\n").replace("\u00b7", " ")
    text = re.sub(r"[\u2018\u2019\u201c\u201d]", "'", text)
    text = re.sub(r"\s+", " ", text)

    # Prefer explicit M-CHAT question/response patterns first (avoid greedy score regex)
    # Try M-CHAT pattern (A# Question? Yes/No format)
    for m in _A_MCHAT_PATTERN.finditer(text):
        idx = int(m.group(1))
        if 1 <= idx <= 10 and f"A{idx}_Score" not in answers:
            val = m.group(2).lower().strip()
            answers[f"A{idx}_Score"] = 1 if val.startswith("yes") else 0

    # Looser M-CHAT pattern to catch cases where formatting or OCR breaks the question token
    if len(answers) < 10:
        for m in _A_MCHAT_LOOSE.finditer(text):
            idx = int(m.group(1))
            if 1 <= idx <= 10 and f"A{idx}_Score" not in answers:
                val = m.group(2).lower().strip()
                answers[f"A{idx}_Score"] = 1 if val.startswith("yes") else 0

    # Try alternative pattern (A# yes/no format)
    if len(answers) < 10:
        for m in _A_SCORE_ALT_PATTERN.finditer(text):
            idx = int(m.group(1))
            if 1 <= idx <= 10 and f"A{idx}_Score" not in answers:
                val = m.group(2).lower()
                answers[f"A{idx}_Score"] = 1 if val in {"yes", "1", "y"} else 0

    # Try primary pattern (A#: 0/1 format) but require a near anchor to avoid spanning to other items
    if len(answers) < 10:
        for m in _A_SCORE_PATTERN.finditer(text):
            idx = int(m.group(1))
            if 1 <= idx <= 10 and f"A{idx}_Score" not in answers:
                answers[f"A{idx}_Score"] = int(m.group(2))

    # Fallback: Look for A markers and find nearest yes/no in following segment
    if len(answers) < 10:
        item_matches = list(_A_ITEM_PATTERN.finditer(text))
        for index, match in enumerate(item_matches):
            idx = int(match.group(1))
            if not 1 <= idx <= 10 or f"A{idx}_Score" in answers:
                continue

            next_start = item_matches[index + 1].start() if index + 1 < len(item_matches) else len(text)
            # extend the search window a bit to account for OCR line breaks
            window_end = min(len(text), next_start + 200)
            segment = text[match.end() : window_end]
            segment_matches = list(re.finditer(r"\b(yes|no)\b", segment, re.IGNORECASE))
            if not segment_matches:
                continue

            val = segment_matches[-1].group(1).lower()
            answers[f"A{idx}_Score"] = 1 if val == "yes" else 0

    return answers


def _infer_scores_from_behavioral_indicators(text: str) -> dict[str, int]:
    """
    Infer A-scores from clinical behavioral descriptions when structured survey data is absent.
    Maps behavioral keywords to autism characteristic domains.
    """
    answers: dict[str, int] = {}
    text_lower = text.lower()
    
    # Check for social/communication challenges (A1-A5)
    social_keywords = _BEHAVIORAL_INDICATORS.get("social", [])
    if any(keyword in text_lower for keyword in social_keywords):
        # Mark social communication items as present
        answers["A1_Score"] = 1  # "prefers solitary activities"
        answers["A2_Score"] = 1  # "difficulty with social interaction"
        answers["A3_Score"] = 1  # "difficulty understanding social cues"
    
    # Check for repetitive/stereotyped behaviors (A6-A8)
    repetitive_keywords = _BEHAVIORAL_INDICATORS.get("repetitive", [])
    if any(keyword in text_lower for keyword in repetitive_keywords):
        answers["A6_Score"] = 1  # "stereotyped behaviors"
        answers["A7_Score"] = 1  # "rigid patterns"
        answers["A8_Score"] = 1  # "restricted interests"
    
    # Check for sensory sensitivities (A9-A10)
    sensory_keywords = _BEHAVIORAL_INDICATORS.get("sensory", [])
    if any(keyword in text_lower for keyword in sensory_keywords):
        answers["A9_Score"] = 1  # "sensory sensitivity"
        answers["A10_Score"] = 1  # "sensory responses"
    
    return answers


def _extract_age(text: str) -> int | None:
    # Try multiple patterns to handle different formats
    patterns = [
        # "Age: 7 years" or "Age 7 years"
        r"(?:Age|age)\s*[:=]?\s*(\d{1,3})\s*(?:years|yrs|y\.o\.)?",
        # "Age / Gender7 years" (M-CHAT format)
        r"(?:Age|age)\s*/\s*(?:Gender|gender)\s*(\d{1,3})\s*(?:years|yrs)",
        # "7 years · Male" after Age/Gender label
        r"(?:Age|age).{0,20}?(\d{1,3})\s*(?:years|yrs)",
    ]
    
    for pattern_str in patterns:
        m = re.search(pattern_str, text, re.IGNORECASE)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                pass
    
    return None


def _extract_gender(text: str) -> str | None:
    m = _GENDER_PATTERN.search(text)
    if not m:
        return None
    val = m.group(1).lower()
    if val.startswith("m"):
        return "m"
    if val.startswith("f"):
        return "f"
    return None


def _extract_ethnicity(text: str) -> str | None:
    """Extract ethnicity from text and normalize it to the canonical training label."""
    text_lower = text.lower()

    labeled_match = re.search(
        r"ethnicity\s*[:/\-]?\s*([A-Za-z][A-Za-z\- ]{2,})",
        text,
        re.IGNORECASE,
    )
    if labeled_match:
        raw_value = labeled_match.group(1).strip().lower().replace("-", " ")
        if "white" in raw_value or "european" in raw_value or "caucasian" in raw_value:
            return "White European"
        if "asian" in raw_value:
            return "Asian"
        if "middle eastern" in raw_value:
            return "Middle Eastern"
        if "black" in raw_value or "african" in raw_value:
            return "Black"
        if "hispanic" in raw_value or "latin" in raw_value:
            return "Hispanic"

    if "white european" in text_lower or "white-european" in text_lower:
        return "White European"
    if "asian" in text_lower:
        return "Asian"
    if "middle eastern" in text_lower or "middle-eastern" in text_lower:
        return "Middle Eastern"
    if "black" in text_lower or "african" in text_lower:
        return "Black"
    if "hispanic" in text_lower or "latin" in text_lower:
        return "Hispanic"

    return None


def _extract_relation(text: str) -> str | None:
    """Extract relation (who is being screened) from text using keyword matching."""
    text_lower = text.lower()
    for keyword, relation_value in _RELATION_KEYWORDS.items():
        if keyword in text_lower:
            return relation_value
    return None


def _extract_family_history(text: str) -> str | None:
    """Extract family history of autism from text."""
    text_lower = text.lower()
    if any(phrase in text_lower for phrase in ["family history", "autism in family", "parent.*autism", "sibling.*autism"]):
        # Check if it's positive or negative
        if any(neg in text_lower for neg in ["no family history", "negative", "absent"]):
            return "no"
        return "yes"
    return None


def _extract_used_app_before(text: str) -> str | None:
    """Extract if user has used screening app before."""
    text_lower = text.lower()
    labeled_match = re.search(
        r"(?:prior screening app|used app before|screening app before)\s*[:/\-]?\s*(yes|no|1|0)",
        text,
        re.IGNORECASE,
    )
    if labeled_match:
        return "yes" if labeled_match.group(1).lower() in {"yes", "1"} else "no"

    if "app before" in text_lower or "screening before" in text_lower or "previously screened" in text_lower:
        if any(neg in text_lower for neg in ["never", "not", "no previous"]):
            return "no"
        return "yes"
    return None


def _extract_jaundice(text: str) -> str | None:
    """Extract jaundice at birth as yes/no."""
    labeled_match = re.search(
        r"jaundice(?:\s+at\s+birth)?\s*[:/\-]?\s*(yes|no|1|0)",
        text,
        re.IGNORECASE,
    )
    if labeled_match:
        return "yes" if labeled_match.group(1).lower() in {"yes", "1"} else "no"

    text_lower = text.lower()
    if "jaundice" in text_lower:
        if any(neg in text_lower for neg in ["no jaundice", "without jaundice", "denies jaundice"]):
            return "no"
        if any(pos in text_lower for pos in ["jaundice at birth yes", "had jaundice", "with jaundice"]):
            return "yes"
    return None


def parse_autism_prediction_request(text: str) -> PredictionRequest:
    """Parse `raw_text` from reports/ocr and build a `PredictionRequest`.

    This uses conservative regex rules based on the legacy Gradio fields (A1..A10 and demographics).
    If no structured survey data is found, infers scores from clinical behavioral indicators.
    Extracts all available demographic fields from the text.
    Missing fields are filled with sensible defaults and logged.
    """
    answers = _extract_binary_answers(text)
    
    # If we didn't find structured A-score data, try to infer from behavioral indicators
    if not answers or sum(answers.values()) == 0:
        inferred = _infer_scores_from_behavioral_indicators(text)
        if inferred:
            answers.update(inferred)
            logger.info("Inferred autism scores from behavioral indicators: found %d indicators", len(inferred))

    # default to 0 for missing answers
    scores = {}
    for i in range(1, 11):
        key = f"A{i}_Score"
        scores[key] = int(answers.get(key, 0))

    # Extract demographics with intelligent fallbacks
    age = _extract_age(text)
    if age is None:
        age = 0

    gender = _extract_gender(text)
    if gender is None:
        gender = "m"  # Default to male if not specified
    
    ethnicity = _extract_ethnicity(text)
    relation = _extract_relation(text)
    jaundice = _extract_jaundice(text)
    
    # Family history (austim field = family history of autism)
    family_history = _extract_family_history(text)
    
    # Used app before
    used_app_before = _extract_used_app_before(text)

    # build SurveyResponses and Demographics
    responses = SurveyResponses(**{k: v for k, v in scores.items()})

    demographics = Demographics(
        gender=gender,
        age=age,
        ethnicity=ethnicity,
        jaundice=jaundice,
        relation=relation,
        austim=family_history,
        contry_of_res=0,
        used_app_before=used_app_before,
        result=None,
    )

    logger.info(
        "Parsed autism prediction request: age=%s gender=%s filled_scores=%d/10 source=%s "
        "ethnicity=%s relation=%s family_history=%s", 
        age, gender, sum(scores.values()), 
        "structured" if answers else "inferred",
        ethnicity, relation, family_history
    )
    return PredictionRequest(responses=responses, demographics=demographics)
