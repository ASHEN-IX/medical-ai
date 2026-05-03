from __future__ import annotations

import re


GLUCOSE_PATTERN = re.compile(
    r"(?:glucose|blood\s*sugar|fasting\s*glucose|fbs|rbs)\s*[:=\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:mg\s*/?\s*dL)?",
    re.IGNORECASE,
)

BP_PATTERN = re.compile(
    r"(?:blood\s*pressure|bp)\s*[:=\-]?\s*(\d{2,3})\s*[/\\]\s*(\d{2,3})",
    re.IGNORECASE,
)

CHOLESTEROL_PATTERN = re.compile(
    r"(?:cholesterol|total\s*cholesterol|chol)\s*[:=\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:mg\s*/?\s*dL)?",
    re.IGNORECASE,
)

BMI_PATTERN = re.compile(
    r"(?:bmi|body\s*mass\s*index)\s*[:=\-]?\s*(\d{1,2}(?:\.\d+)?)",
    re.IGNORECASE,
)

KIDNEY_MARKER_KEYWORDS = (
    "creatinine",
    "egfr",
    "gfr",
    "bun",
    "urea",
    "albuminuria",
    "proteinuria",
    "ckd",
    "kidney",
)

HEART_MARKER_KEYWORDS = (
    "cholesterol",
    "blood pressure",
    "bp",
    "ldl",
    "hdl",
    "triglycerides",
)

AUTISM_MARKER_KEYWORDS = (
    "autism",
    "autism spectrum",
    "asd",
    "asperger",
    "pdd",
    "pervasive developmental",
    "social communication disorder",
    "sensory",
    "repetitive behavior",
    "atypical development",
)

DIABETES_MARKER_KEYWORDS = (
    "glucose",
    "blood sugar",
    "hba1c",
    "diabetes",
)
