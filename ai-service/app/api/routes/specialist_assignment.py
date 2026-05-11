"""FastAPI route for LLM-based specialist assignment."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, BaseModel, Field, model_validator

try:
    from groq import Groq
except ImportError:  # pragma: no cover
    Groq = None

logger = logging.getLogger(__name__)
router = APIRouter(tags=["specialist-assignment"])


class DoctorProfile(BaseModel):
    """Doctor profile for specialist assignment."""

    id: str = Field(validation_alias=AliasChoices("id", "doctor_id"))
    name: str
    specialty: str
    experience_years: int = Field(
        default=0,
        validation_alias=AliasChoices("experience_years", "years_experience"),
    )
    current_caseload: int = 0
    max_caseload: int = 20
    rating: float = 5.0
    verified: bool = True


class SpecialistAssignmentRequest(BaseModel):
    """Request for LLM-based specialist assignment."""

    disease: str = Field(..., description="Disease/condition name")
    risk_level: str = Field(
        "NORMAL", description="Risk level (NORMAL, WARNING, HIGH, CRITICAL)"
    )
    available_doctors: list[DoctorProfile] = Field(
        ..., description="List of available doctors"
    )
    patient_info: dict[str, Any] | None = Field(
        None, description="Additional patient context"
    )
    case_notes: str | None = Field(None, description="Clinical case notes")

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_payload(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values

        payload = dict(values)

        # Backward compatibility with legacy payloads using {patient, doctors}
        if "available_doctors" not in payload and "doctors" in payload:
            payload["available_doctors"] = payload.get("doctors")

        if "patient_info" not in payload and "patient" in payload:
            payload["patient_info"] = payload.get("patient")

        if "disease" not in payload:
            patient = payload.get("patient") or payload.get("patient_info") or {}
            if isinstance(patient, dict):
                diagnosed = patient.get("diagnosed_conditions") or patient.get("diagnoses") or []
                if diagnosed and isinstance(diagnosed, list):
                    payload["disease"] = str(diagnosed[0])

        if "risk_level" not in payload:
            patient = payload.get("patient") or payload.get("patient_info") or {}
            if isinstance(patient, dict):
                severity = str(patient.get("severity_level") or "NORMAL").upper()
                mapping = {
                    "LOW": "NORMAL",
                    "MEDIUM": "WARNING",
                    "SEVERE": "HIGH",
                }
                payload["risk_level"] = mapping.get(severity, severity)

        return payload


class SpecialistAssignmentResponse(BaseModel):
    """Response with ranked specialist recommendations."""

    primary: DoctorProfile = Field(..., description="Top recommended specialist")
    alternates: list[DoctorProfile] = Field(
        default_factory=list, description="Alternative specialists"
    )
    reasoning: str = Field(..., description="Explanation for assignment")
    confidence_score: float = Field(
        ..., description="Confidence in the assignment (0-1)"
    )


def _heuristic_rank(
    disease: str,
    risk_level: str,
    available_doctors: list[DoctorProfile],
) -> dict[str, Any]:
    """Safe deterministic ranking used as fallback and baseline."""
    scored_doctors: list[dict[str, Any]] = []

    for doctor in available_doctors:
        max_caseload = doctor.max_caseload if doctor.max_caseload > 0 else 1

        # Experience score (0-30 points)
        experience_score = min(doctor.experience_years * 2, 30)

        # Caseload score (0-30 points) - lower caseload is better
        caseload_ratio = max(0.0, 1 - (doctor.current_caseload / max_caseload))
        caseload_score = caseload_ratio * 30

        # Rating score (0-25 points)
        rating_score = max(0.0, min((doctor.rating / 5.0) * 25, 25))

        # Specialty match score (0-15 points)
        specialty_score = 15 if disease.lower() in doctor.specialty.lower() else 8

        # Critical cases bias towards experience
        if risk_level.upper() == "CRITICAL" and doctor.experience_years >= 5:
            specialty_score += 10

        score = experience_score + caseload_score + rating_score + specialty_score

        scored_doctors.append(
            {
                **doctor.model_dump(),
                "score": round(score, 2),
                "reasoning": (
                    f"Experience: {doctor.experience_years}y, "
                    f"Caseload: {doctor.current_caseload}/{doctor.max_caseload}, "
                    f"Rating: {doctor.rating}/5"
                ),
            }
        )

    scored_doctors.sort(key=lambda x: x["score"], reverse=True)

    primary = scored_doctors[0]
    alternates = scored_doctors[1:3]
    confidence = min(0.95, max(0.5, primary["score"] / 100))

    return {
        "primary": primary,
        "alternates": alternates,
        "reasoning": "Heuristic ranking based on experience, load, rating, and specialty.",
        "confidence_score": confidence,
        "ranked": scored_doctors,
    }


def _strip_code_fence(content: str) -> str:
    lines = content.splitlines()
    if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].startswith("```"):
        return "\n".join(lines[1:-1]).strip()
    return content.strip("`").strip()


def _parse_llm_json(raw_content: str) -> dict[str, Any]:
    stripped = raw_content.strip()
    if stripped.startswith("```"):
        stripped = _strip_code_fence(stripped)
    return json.loads(stripped)


def _build_llm_messages(
    disease: str,
    risk_level: str,
    available_doctors: list[DoctorProfile],
    patient_info: dict[str, Any] | None,
    case_notes: str | None,
) -> list[dict[str, str]]:
    doctor_payload = [d.model_dump() for d in available_doctors]
    return [
        {
            "role": "system",
            "content": (
                "You are a clinical assignment engine. "
                "Rank specialists for a patient case. "
                "Return STRICT JSON only with keys: "
                "ordered_doctor_ids (array), reasoning (string), confidence_score (number 0..1)."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "disease": disease,
                    "risk_level": risk_level,
                    "patient_info": patient_info or {},
                    "case_notes": case_notes or "",
                    "available_doctors": doctor_payload,
                }
            ),
        },
    ]


def rank_specialists_with_llm(
    disease: str,
    risk_level: str,
    available_doctors: list[DoctorProfile],
    patient_info: dict[str, Any] | None,
    case_notes: str | None,
) -> dict[str, Any]:
    """
    Rank available specialists using LLM logic.

    Algorithm:
    1. Filter doctors by specialty match for disease
    2. Score by experience, caseload, rating
    3. Use LLM to refine ranking based on clinical context
    4. Return ranked list with confidence scores
    """
    if not available_doctors:
        raise HTTPException(status_code=400, detail="No doctors available")

    baseline = _heuristic_rank(disease, risk_level, available_doctors)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or Groq is None:
        baseline["reasoning"] = (
            "Groq is not configured. " + baseline["reasoning"]
        )
        return baseline

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            messages=_build_llm_messages(
                disease,
                risk_level,
                available_doctors,
                patient_info,
                case_notes,
            ),
            temperature=0.1,
            top_p=1,
            max_completion_tokens=600,
            response_format={"type": "json_object"},
        )
        raw_content = completion.choices[0].message.content or "{}"
        parsed = _parse_llm_json(raw_content)

        ordered_ids = parsed.get("ordered_doctor_ids", [])
        if not isinstance(ordered_ids, list) or not ordered_ids:
            return baseline

        by_id = {str(doc["id"]): doc for doc in baseline["ranked"]}
        ranked: list[dict[str, Any]] = []

        for doctor_id in ordered_ids:
            key = str(doctor_id)
            if key in by_id:
                ranked.append(by_id.pop(key))

        # Keep any remaining doctors appended in baseline order
        for remaining in baseline["ranked"]:
            if str(remaining["id"]) in by_id:
                ranked.append(remaining)

        if not ranked:
            return baseline

        primary = ranked[0]
        alternates = ranked[1:3]
        llm_confidence = parsed.get("confidence_score", baseline["confidence_score"])
        confidence = (
            float(llm_confidence)
            if isinstance(llm_confidence, (int, float))
            else baseline["confidence_score"]
        )
        confidence = max(0.0, min(1.0, confidence))

        return {
            "primary": primary,
            "alternates": alternates,
            "reasoning": parsed.get("reasoning")
            or "LLM-assisted ranking completed.",
            "confidence_score": confidence,
            "ranked": ranked,
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Specialist LLM ranking failed, using heuristic fallback: %s", exc)
        return baseline


@router.post("/specialist/assign", response_model=SpecialistAssignmentResponse)
async def assign_specialist(request: SpecialistAssignmentRequest):
    """
    Assign best-fit specialist for a disease case using LLM ranking.

    Uses intelligent scoring based on:
    - Doctor experience and specialty match
    - Current caseload and availability
    - Patient risk level and clinical context
    - LLM-powered reasoning for complex cases
    """
    try:
        logger.info(
            f"Assigning specialist for {request.disease} (risk: {request.risk_level})"
        )

        result = rank_specialists_with_llm(
            disease=request.disease,
            risk_level=request.risk_level,
            available_doctors=request.available_doctors,
            patient_info=request.patient_info,
            case_notes=request.case_notes,
        )

        response = SpecialistAssignmentResponse(
            primary=DoctorProfile(**result["primary"]),
            alternates=[DoctorProfile(**alt) for alt in result["alternates"]],
            reasoning=result["reasoning"],
            confidence_score=result["confidence_score"],
        )

        logger.info(
            f"Assigned Dr. {response.primary.name} ({response.primary.specialty}) "
            f"for {request.disease} with confidence {response.confidence_score:.2%}"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Specialist assignment failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Specialist assignment failed: {str(e)}"
        )


@router.post("/specialist/rank")
async def rank_specialists_by_disease(request: SpecialistAssignmentRequest):
    """
    Rank available specialists for a disease without assigning.

    Useful for understanding the scoring logic and alternatives.
    """
    try:
        result = rank_specialists_with_llm(
            disease=request.disease,
            risk_level=request.risk_level,
            available_doctors=request.available_doctors,
            patient_info=request.patient_info,
            case_notes=request.case_notes,
        )

        return {
            "rankings": [
                {
                    "rank": 1,
                    "doctor": result["primary"],
                    "score": result["primary"]["score"],
                    "confidence": result["confidence_score"],
                },
                *[
                    {
                        "rank": i + 2,
                        "doctor": alt,
                        "score": alt["score"],
                        "confidence": min(1.0, max(0.0, alt["score"] / 100)),
                    }
                    for i, alt in enumerate(result["alternates"])
                ],
            ],
            "disease": request.disease,
            "risk_level": request.risk_level,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Specialist ranking failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Specialist ranking failed: {str(e)}"
        )


@router.get("/specialist/specialties")
async def get_disease_specialties() -> dict[str, str]:
    """Get mapping of diseases to medical specialties."""
    return {
        "diabetes": "Endocrinology",
        "heart": "Cardiology",
        "kidney": "Nephrology",
        "stroke": "Neurology",
        "liver": "Hepatology",
        "thyroid": "Endocrinology",
        "autism": "Developmental Pediatrics",
        "autism-dl": "Developmental Pediatrics",
    }
