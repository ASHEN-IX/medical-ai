"""
Gemini-powered medical report extractor.

Flow:
  1. Receive raw PDF/image bytes from OCR service.
  2. Extract text via PyMuPDF → pytesseract fallback.
  3. Call Gemini to detect disease type AND fill the JSON template in one prompt.
  4. Validate the returned JSON against the expected schema (Pydantic).
  5. Retry up to MAX_ATTEMPTS if JSON is incomplete or invalid.
  6. If all Gemini attempts fail, fall back to the legacy regex parsers.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional heavy deps — guarded so the module always importable
# ---------------------------------------------------------------------------
try:
    import fitz  # PyMuPDF
    _PYMUPDF_AVAILABLE = True
except ImportError:
    fitz = None  # type: ignore[assignment]
    _PYMUPDF_AVAILABLE = False

try:
    import pytesseract
    from PIL import Image
    _TESSERACT_AVAILABLE = True
except ImportError:
    pytesseract = None  # type: ignore[assignment]
    Image = None  # type: ignore[assignment]
    _TESSERACT_AVAILABLE = False

try:
    import google.generativeai as genai
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore[assignment]
    _GENAI_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_ATTEMPTS = 3
TEMPLATES_DIR = Path(__file__).parent.parent / "extraction_templates"

# Maps disease key → template file name
DISEASE_TEMPLATES: dict[str, str] = {
    "autism":   "autism.json",
    "diabetes": "diabetes.json",
    "heart":    "heart.json",
    "liver":    "liver.json",
    "kidney":   "kidney.json",
    "stroke":   "stroke.json",
}

# Fields that MUST be non-default for the JSON to be considered "filled"
REQUIRED_NON_ZERO: dict[str, list[str]] = {
    "autism":   [f"A{i}_Score" for i in range(1, 11)],
    "diabetes": ["Glucose", "Age"],
    "heart":    ["age", "blood_pressure"],
    "liver":    ["age", "total_bilirubin"],
    "kidney":   ["age", "hemo", "sc"],
    "stroke":   ["age", "bmi", "avg_glucose_level"],
}


# ---------------------------------------------------------------------------
# Helper: load template
# ---------------------------------------------------------------------------
def _load_template(disease: str) -> dict[str, Any]:
    path = TEMPLATES_DIR / DISEASE_TEMPLATES[disease]
    with path.open("r", encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
    # Strip meta-only keys so model only sees real fields
    return {k: v for k, v in data.items() if not k.startswith("_")}


# ---------------------------------------------------------------------------
# Helper: text extraction
# ---------------------------------------------------------------------------
def extract_text(file_bytes: bytes, filename: str = "report.pdf") -> str:
    """
    Try PyMuPDF first, fall back to pytesseract, then raw byte decode.
    Returns the best text we can get.
    """
    suffix = Path(filename).suffix.lower()

    # --- PyMuPDF (best for text-layer PDFs) ---
    if _PYMUPDF_AVAILABLE and (suffix == ".pdf" or file_bytes[:4] == b"%PDF"):
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")  # type: ignore[call-arg]
            pages = [page.get_text() for page in doc]
            text = "\n".join(pages).strip()
            if len(text) >= 50:
                logger.info("PyMuPDF extraction succeeded chars=%d", len(text))
                return text
        except Exception as exc:
            logger.warning("PyMuPDF failed: %s", exc)

    # --- pytesseract (OCR for scanned PDFs / images) ---
    if _TESSERACT_AVAILABLE and Image is not None:
        try:
            if suffix == ".pdf" or file_bytes[:4] == b"%PDF":
                # Render PDF pages as images using PyMuPDF if available
                if _PYMUPDF_AVAILABLE:
                    doc = fitz.open(stream=file_bytes, filetype="pdf")  # type: ignore[call-arg]
                    segments: list[str] = []
                    for page in doc:
                        pix = page.get_pixmap(dpi=200)
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        segments.append(pytesseract.image_to_string(img).strip())
                    text = "\n".join(segments).strip()
                    if len(text) >= 50:
                        logger.info("Tesseract PDF-render extraction succeeded chars=%d", len(text))
                        return text
            else:
                img = Image.open(BytesIO(file_bytes)).convert("RGB")
                text = pytesseract.image_to_string(img).strip()
                if len(text) >= 50:
                    logger.info("Tesseract image OCR succeeded chars=%d", len(text))
                    return text
        except Exception as exc:
            logger.warning("Tesseract extraction failed: %s", exc)

    # --- PyPDF2 fallback ---
    try:
        from PyPDF2 import PdfReader  # type: ignore[import]
        reader = PdfReader(BytesIO(file_bytes))
        segments = [(p.extract_text() or "").strip() for p in reader.pages]
        text = "\n".join(s for s in segments if s).strip()
        if len(text) >= 50:
            logger.info("PyPDF2 extraction succeeded chars=%d", len(text))
            return text
    except Exception as exc:
        logger.warning("PyPDF2 fallback failed: %s", exc)

    # --- Raw byte decode last resort ---
    decoded = file_bytes.decode("utf-8", errors="ignore")
    printable = "".join(c if c.isprintable() else " " for c in decoded)
    compact = " ".join(printable.split())
    logger.warning("Using raw byte decode fallback chars=%d", len(compact))
    return compact


# ---------------------------------------------------------------------------
# Helper: build Gemini prompt
# ---------------------------------------------------------------------------
def _build_prompt(raw_text: str, disease: str | None = None) -> str:
    templates_block = ""
    if disease and disease in DISEASE_TEMPLATES:
        template = _load_template(disease)
        templates_block = (
            f"\nThe disease is already detected as: **{disease}**\n"
            f"Fill this exact JSON template (do NOT add or remove keys):\n"
            f"```json\n{json.dumps(template, indent=2)}\n```\n"
        )
    else:
        all_templates: dict[str, Any] = {}
        for d, fname in DISEASE_TEMPLATES.items():
            all_templates[d] = _load_template(d)
        templates_block = (
            "\nAvailable disease templates (pick ONE and fill it):\n"
            + json.dumps(all_templates, indent=2)
            + "\n"
        )

    return f"""You are a medical data extraction AI.
Read the medical report text below and:
1. Identify which disease category this report belongs to (autism, diabetes, heart, liver, kidney, or stroke).
2. Extract every relevant clinical value from the report text.
3. Return ONLY a valid JSON object with two keys:
   - "disease": the detected disease string (one of: autism, diabetes, heart, liver, kidney, stroke)
   - "data": the filled template JSON for that disease

Rules:
- For numeric fields use numbers (not strings).
- For boolean-like fields (yes/no, 0/1) follow the template type exactly.
- Leave unknown fields at their template default value (0, 0.0, or "").
- Do NOT include markdown fences, explanation text, or extra keys — ONLY the JSON object.
- For autism: A_Score fields — 1 means the symptom IS present (Yes), 0 means it is NOT present (No).
- Ensure the "result" field in autism equals the sum of A1_Score through A10_Score.

{templates_block}

--- MEDICAL REPORT TEXT START ---
{raw_text[:6000]}
--- MEDICAL REPORT TEXT END ---

Respond with ONLY the JSON object:"""


# ---------------------------------------------------------------------------
# Helper: parse and clean Gemini output
# ---------------------------------------------------------------------------
def _parse_gemini_output(raw: str) -> dict[str, Any]:
    # Strip markdown fences if present
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned.strip())


# ---------------------------------------------------------------------------
# Helper: validate filled template
# ---------------------------------------------------------------------------
def _is_complete(disease: str, data: dict[str, Any], attempt: int) -> tuple[bool, list[str]]:
    """
    Returns (is_complete, list_of_missing_fields).
    On final attempt (3rd) we accept whatever we have.
    """
    if attempt >= MAX_ATTEMPTS:
        return True, []

    required = REQUIRED_NON_ZERO.get(disease, [])
    missing = []
    for field in required:
        val = data.get(field)
        if val is None or val == 0 or val == "" or val == 0.0:
            missing.append(field)

    return len(missing) == 0, missing


# ---------------------------------------------------------------------------
# Helper: validate types against template defaults
# ---------------------------------------------------------------------------
def _coerce_types(disease: str, data: dict[str, Any]) -> dict[str, Any]:
    """Coerce extracted values to match template types."""
    template = _load_template(disease)
    result: dict[str, Any] = {}
    
    # Create a case-insensitive lookup for the input data
    data_lookup = {str(k).lower(): v for k, v in data.items()}
    
    for key, default in template.items():
        # Try exact match first, then case-insensitive
        val = data.get(key)
        if val is None:
            val = data_lookup.get(str(key).lower(), default)
            
        try:
            if isinstance(default, int):
                result[key] = int(float(str(val))) if val not in ("", None) else default
            elif isinstance(default, float):
                result[key] = float(str(val)) if val not in ("", None) else default
            else:
                result[key] = str(val) if val is not None else default
        except (ValueError, TypeError):
            result[key] = default
    return result


# ---------------------------------------------------------------------------
# Main public API
# ---------------------------------------------------------------------------
class GeminiExtractorError(RuntimeError):
    pass


class GeminiExtractor:
    """
    Extracts structured model-ready data from a medical report using Gemini.

    Usage:
        extractor = GeminiExtractor()
        result = extractor.extract(file_bytes, filename="report.pdf")
        # result.disease  → "autism"
        # result.data     → dict ready to pass to the prediction service
        # result.raw_text → the OCR-extracted text
        # result.method   → "gemini" | "fallback_regex"
    """

    def __init__(self, api_key: str | None = None, model_name: str = "gemini-2.5-flash") -> None:
        self.model_name = model_name
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self._client = None

        if _GENAI_AVAILABLE and self._api_key:
            genai.configure(api_key=self._api_key)
            self._client = genai.GenerativeModel(model_name)
            logger.info("GeminiExtractor initialised model=%s", model_name)
        else:
            logger.warning(
                "GeminiExtractor: google-generativeai not available or GEMINI_API_KEY not set. "
                "Will use legacy regex fallback only."
            )

    # ------------------------------------------------------------------
    def extract(
        self,
        file_bytes: bytes,
        filename: str = "report.pdf",
        hint_disease: str | None = None,
        image_bytes: bytes | None = None,
    ) -> "ExtractionResult":
        """
        Main entry point. Returns ExtractionResult.
        """
        raw_text = extract_text(file_bytes, filename)
        
        # --- Try Gemini extraction ---
        if self._client is not None:
            # If it's an image, pass bytes directly for multimodal analysis
            img_input = image_bytes
            if not img_input and any(filename.lower().endswith(s) for s in [".jpg", ".jpeg", ".png"]):
                img_input = file_bytes

            result = self._try_gemini(raw_text, hint_disease, image_bytes=img_input)
            if result is not None:
                return result

        # --- Fallback: legacy regex parsers ---
        logger.warning("Gemini extraction failed or unavailable. Falling back to regex parsers.")
        return self._legacy_fallback(raw_text)

    # ------------------------------------------------------------------
    def _try_gemini(self, raw_text: str, hint_disease: str | None, image_bytes: bytes | None = None) -> "ExtractionResult | None":
        if self._client is None:
            logger.warning("GeminiExtractor._try_gemini called but _client is None (API key missing?)")
            return None

        last_error: Exception | None = None
        partial_data: dict[str, Any] | None = None
        detected_disease: str | None = None

        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                prompt = _build_prompt(raw_text, hint_disease or detected_disease)
                logger.info("Gemini extraction attempt=%d/%d multimodal=%s", 
                            attempt, MAX_ATTEMPTS, bool(image_bytes))

                # Remove response_mime_type to ensure compatibility with all versions of the SDK
                # The prompt strongly instructs the model to return ONLY JSON.
                generation_config = {
                    "temperature": 0.1,
                    "max_output_tokens": 2048,
                }

                # Multimodal support: pass image directly if provided
                content: list[Any] = [prompt]
                if image_bytes and attempt == 1: # Only pass image on 1st attempt to save tokens
                    content.append({
                        "mime_type": "image/jpeg",
                        "data": image_bytes
                    })

                response = self._client.generate_content(
                    content,
                    generation_config=generation_config,
                )
                
                raw_output = response.text or ""
                parsed = json.loads(raw_output)

                disease = str(parsed.get("disease", "")).strip().lower()
                data = parsed.get("data", {})

                if disease not in DISEASE_TEMPLATES:
                    logger.warning("Gemini returned unknown disease=%s", disease)
                    continue

                detected_disease = disease
                coerced = _coerce_types(disease, data)
                normalized = self._normalize_clinical_values(disease, coerced)
                partial_data = normalized

                complete, missing = _is_complete(disease, normalized, attempt)
                if complete:
                    return ExtractionResult(
                        disease=disease,
                        data=normalized,
                        raw_text=raw_text,
                        method="gemini_multimodal" if image_bytes else "gemini",
                        attempts=attempt,
                    )

                logger.warning("Gemini JSON incomplete missing=%s", missing)
                hint_disease = disease

            except Exception as exc:
                last_error = exc
                logger.warning("Gemini attempt=%d failed: %s", attempt, exc)

            time.sleep(0.5 * attempt)

        if partial_data and detected_disease:
            return ExtractionResult(
                disease=detected_disease,
                data=partial_data,
                raw_text=raw_text,
                method="gemini_partial",
                attempts=MAX_ATTEMPTS,
            )

        return None

    def _normalize_clinical_values(self, disease: str, data: dict[str, Any]) -> dict[str, Any]:
        """Normalize categorical strings to model-specific numeric codes."""
        normalized = data.copy()
        
        # Gender normalization (m/male -> 1, f/female -> 0)
        if "gender" in normalized:
            val = str(normalized["gender"]).lower()
            if any(m in val for m in ["m", "male", "boy", "man"]):
                normalized["gender"] = 1
            elif any(f in val for f in ["f", "female", "girl", "woman"]):
                normalized["gender"] = 0

        # Boolean-like normalization (yes/positive -> 1, no/negative -> 0)
        for key in normalized:
            if isinstance(normalized[key], str):
                val = normalized[key].lower()
                if val in ["yes", "positive", "true", "present"]:
                    normalized[key] = 1
                elif val in ["no", "negative", "false", "absent"]:
                    normalized[key] = 0

        # Autism specific: ensure result is sum of A scores
        if disease == "autism":
            score_keys = [f"A{i}_Score" for i in range(1, 11)]
            total = sum(int(normalized.get(k, 0)) for k in score_keys)
            normalized["result"] = float(total)

        return normalized

    # ------------------------------------------------------------------
    def _legacy_fallback(self, raw_text: str) -> "ExtractionResult":
        """
        Best-effort disease detection + regex extraction using existing parsers.
        """
        disease = self._detect_disease_from_text(raw_text)
        data = self._regex_extract(raw_text, disease)

        logger.info("Legacy fallback extraction disease=%s", disease)
        return ExtractionResult(
            disease=disease,
            data=data,
            raw_text=raw_text,
            method="fallback_regex",
            attempts=0,
        )

    def _detect_disease_from_text(self, text: str) -> str:
        """Simple keyword-based disease detection."""
        import importlib.util
        from pathlib import Path as P

        index_path = TEMPLATES_DIR / "index.json"
        with index_path.open("r") as fh:
            index = json.load(fh)

        keywords: dict[str, list[str]] = index.get("report_type_keywords", {})
        text_lower = text.lower()
        scores: dict[str, int] = {}
        for disease, kws in keywords.items():
            scores[disease] = sum(1 for kw in kws if kw.lower() in text_lower)

        best = max(scores, key=lambda d: scores[d]) if scores else "autism"
        if scores.get(best, 0) == 0:
            best = "autism"  # safe default
        return best

    def _regex_extract(self, raw_text: str, disease: str) -> dict[str, Any]:
        """Delegate to the appropriate legacy parser."""
        template = _load_template(disease)

        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent.parent))

            if disease == "autism":
                from app.services.autism_parser import parse_autism_prediction_request  # type: ignore[import]
                parsed = parse_autism_prediction_request(raw_text)
                responses = parsed.responses.model_dump()
                demographics = parsed.demographics.model_dump()
                data = {**responses}
                data["age"] = demographics.get("age") or 0
                data["gender"] = demographics.get("gender") or ""
                data["ethnicity"] = demographics.get("ethnicity") or ""
                data["jaundice"] = demographics.get("jaundice") or ""
                data["austim"] = demographics.get("austim") or ""
                data["contry_of_res"] = str(demographics.get("contry_of_res") or "")
                data["used_app_before"] = demographics.get("used_app_before") or ""
                data["result"] = float(sum(responses.get(f"A{i}_Score", 0) for i in range(1, 11)))
                data["relation"] = str(demographics.get("relation") or "")
                return _coerce_types(disease, data)
                
            elif disease == "kidney":
                from app.services.kidney_parser import parse_kidney_request  # type: ignore[import]
                data = parse_kidney_request(raw_text)
                return _coerce_types(disease, data)
                
            elif disease == "diabetes":
                from app.services.diabetes_parser import parse_diabetes_request  # type: ignore[import]
                data = parse_diabetes_request(raw_text)
                return _coerce_types(disease, data)
                
            elif disease == "heart":
                from app.services.heart_parser import parse_heart_request  # type: ignore[import]
                data = parse_heart_request(raw_text)
                return _coerce_types(disease, data)
                
            elif disease == "liver":
                from app.services.liver_parser import parse_liver_request  # type: ignore[import]
                data = parse_liver_request(raw_text)
                return _coerce_types(disease, data)
                
            elif disease == "stroke":
                from app.services.stroke_parser import parse_stroke_request  # type: ignore[import]
                data = parse_stroke_request(raw_text)
                return _coerce_types(disease, data)
                
            elif disease == "thyroid":
                from app.services.thyroid_parser import parse_thyroid_request  # type: ignore[import]
                data = parse_thyroid_request(raw_text)
                return _coerce_types(disease, data)

        except Exception as exc:
            logger.warning("Legacy parser for %s failed: %s", disease, exc)

        # For unknown diseases or if parsing failed, return the template defaults
        return template


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
class ExtractionResult:
    """Holds the output of a GeminiExtractor.extract() call."""

    __slots__ = ("disease", "data", "raw_text", "method", "attempts")

    def __init__(
        self,
        disease: str,
        data: dict[str, Any],
        raw_text: str,
        method: str,
        attempts: int,
    ) -> None:
        self.disease = disease
        self.data = data
        self.raw_text = raw_text
        self.method = method
        self.attempts = attempts

    def __repr__(self) -> str:
        return (
            f"ExtractionResult(disease={self.disease!r}, method={self.method!r}, "
            f"attempts={self.attempts}, fields={len(self.data)})"
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "disease": self.disease,
            "data": self.data,
            "method": self.method,
            "attempts": self.attempts,
        }
