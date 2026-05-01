from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import StrokeRequest, StrokeResponse, ErrorResponse
from app.services.stroke_service import StrokeService


router = APIRouter(tags=["stroke"])
service = StrokeService()


@router.post(
    "/ai/stroke",
    response_model=StrokeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def predict_stroke(
    payload: StrokeRequest,
    request: Request,
) -> StrokeResponse:
    """
    Predict stroke risk based on patient clinical parameters.
    
    Parameters:
    - age: Patient age (0-120)
    - hypertension: 1 if patient has hypertension, 0 otherwise
    - heart_disease: 1 if patient has heart disease, 0 otherwise
    - avg_glucose_level: Average glucose level (0-300)
    - bmi: Body Mass Index (0-60)
    - ever_married: "Yes" or "No"
    - work_type: "Self-employed", "children", "Private", "Govt_job", or "Never_worked"
    - smoking_status: "Unknown", "formerly smoked", "never smoked", or "smokes"
    """
    request_id = getattr(request.state, "request_id", "req_unknown")
    
    try:
        return service.predict(payload, request_id=request_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "STROKE_PREDICTION_FAILED",
                "message": "Stroke prediction failed",
                "details": str(exc),
            },
        ) from exc
