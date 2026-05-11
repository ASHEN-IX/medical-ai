"""
Prevention Plan Generator — AI-driven lifestyle recommendation service.
Uses LLM + patient context to generate personalized prevention plans.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class PreventionPlanService:
    """Generate personalized prevention plans based on patient data."""

    DIAGNOSIS_ALIASES: dict[str, str] = {
        "heart_disease": "heart",
        "heart disease": "heart",
        "kidney_disease": "kidney",
        "kidney disease": "kidney",
        "liver_disease": "liver",
        "liver disease": "liver",
        "stroke_prediction": "stroke",
        "stroke risk": "stroke",
        "thyroid-prediction": "thyroid",
        "thyroid disease": "thyroid",
        "autism-prediction": "autism",
    }

    RISK_FACTOR_RECOMMENDATIONS: dict[str, dict[str, list[str]]] = {
        "smoking": {
            "diet": [],
            "exercise": [],
            "sleep": [],
            "stress": ["Use behavioral coaching or support groups for smoking cessation"],
            "followup": ["Enroll in a structured smoking cessation program"],
        },
        "obesity": {
            "diet": ["Target gradual weight loss with a calorie-controlled nutrition plan"],
            "exercise": ["Begin with low-impact activity and increase weekly movement goals"],
            "sleep": ["Screen for sleep quality issues that can impact appetite and weight"],
            "stress": [],
            "followup": ["Track waist circumference and weight trends monthly"],
        },
        "sedentary": {
            "diet": [],
            "exercise": ["Break prolonged sitting with 3-5 minute movement every hour"],
            "sleep": [],
            "stress": [],
            "followup": ["Use weekly activity tracking to maintain adherence"],
        },
        "hypertension": {
            "diet": ["Adopt a DASH-style eating pattern and reduce sodium intake"],
            "exercise": ["Add regular aerobic activity to support blood pressure control"],
            "sleep": [],
            "stress": ["Practice stress-reduction methods to limit BP spikes"],
            "followup": ["Monitor blood pressure at home at least 3 times per week"],
        },
        "alcohol": {
            "diet": ["Limit alcohol intake and avoid binge drinking"],
            "exercise": [],
            "sleep": ["Avoid alcohol close to bedtime to preserve sleep quality"],
            "stress": [],
            "followup": ["Discuss alcohol use targets with a clinician if intake is frequent"],
        },
        "family_history": {
            "diet": [],
            "exercise": [],
            "sleep": [],
            "stress": [],
            "followup": ["Increase preventive screening frequency based on family history"],
        },
    }

    DISEASE_RECOMMENDATIONS: dict[str, dict[str, list[str]]] = {
        "diabetes": {
            "diet": [
                "Follow a low glycemic index diet",
                "Limit refined carbohydrates and added sugars",
                "Increase fiber intake with whole grains and vegetables",
                "Monitor portion sizes for carbohydrate-rich foods",
                "Include healthy fats from nuts, olive oil, and avocados",
            ],
            "exercise": [
                "150 minutes of moderate aerobic exercise per week",
                "Include resistance training 2-3 times per week",
                "Take a 10-15 minute walk after meals",
                "Monitor blood glucose before and after exercise",
            ],
            "sleep": [
                "Maintain consistent sleep schedule (7-9 hours)",
                "Poor sleep affects insulin sensitivity — prioritize rest",
            ],
            "stress": [
                "Practice daily relaxation techniques",
                "High cortisol levels can raise blood sugar",
            ],
            "followup": [
                "HbA1c test every 3 months",
                "Annual eye exam for diabetic retinopathy",
                "Regular foot examinations",
                "Kidney function tests annually",
            ],
        },
        "heart": {
            "diet": [
                "Follow a Mediterranean or DASH diet",
                "Limit sodium to under 2300mg per day",
                "Increase omega-3 fatty acids (fish, flaxseed)",
                "Eat at least 5 servings of fruits and vegetables daily",
                "Limit saturated fats and trans fats",
            ],
            "exercise": [
                "150 minutes of moderate cardio per week",
                "Start slowly and gradually increase intensity",
                "Include flexibility and balance exercises",
            ],
            "sleep": ["Aim for 7-8 hours of quality sleep", "Screen for sleep apnea if snoring"],
            "stress": [
                "Chronic stress raises blood pressure",
                "Practice meditation or deep breathing daily",
            ],
            "followup": [
                "Blood pressure monitoring weekly",
                "Lipid panel every 6 months",
                "ECG annually or as recommended",
            ],
        },
        "kidney": {
            "diet": [
                "Limit sodium, potassium, and phosphorus intake",
                "Control protein intake as advised",
                "Stay well hydrated with water",
                "Avoid processed and canned foods",
            ],
            "exercise": [
                "Moderate exercise 30 minutes most days",
                "Avoid extreme endurance activities",
            ],
            "sleep": ["Adequate rest supports kidney recovery"],
            "stress": ["Stress can raise blood pressure, worsening kidney function"],
            "followup": [
                "eGFR and creatinine every 3 months",
                "Urine albumin-to-creatinine ratio",
                "Blood pressure monitoring",
            ],
        },
        "liver": {
            "diet": [
                "Reduce processed sugar and refined carbohydrates",
                "Prefer whole foods and high-fiber meals",
                "Avoid excessive alcohol intake",
            ],
            "exercise": [
                "Aim for at least 150 minutes of moderate activity weekly",
                "Include strength training twice weekly",
            ],
            "sleep": ["Maintain 7-9 hours of restorative sleep to support metabolic health"],
            "stress": ["Use stress-reduction routines to reduce inflammatory burden"],
            "followup": [
                "Liver function tests every 3-6 months",
                "Ultrasound follow-up as advised",
                "Track weight and waist circumference monthly",
            ],
        },
        "stroke": {
            "diet": [
                "Follow a Mediterranean/DASH pattern to reduce vascular risk",
                "Reduce sodium and ultra-processed food intake",
            ],
            "exercise": [
                "Maintain regular cardiovascular exercise most days of the week",
                "Include balance and mobility training",
            ],
            "sleep": ["Screen for sleep apnea and maintain consistent sleep timing"],
            "stress": ["Use daily stress management to support blood pressure stability"],
            "followup": [
                "Monitor blood pressure regularly",
                "Check cholesterol and glucose every 3-6 months",
                "Review stroke warning signs with family members",
            ],
        },
        "thyroid": {
            "diet": [
                "Ensure adequate iodine intake through balanced nutrition",
                "Avoid unnecessary high-dose iodine supplements unless prescribed",
            ],
            "exercise": [
                "Use moderate exercise to support metabolic and cardiovascular health",
            ],
            "sleep": ["Maintain regular sleep to reduce fatigue and hormonal stress"],
            "stress": ["Track stress and mood changes that may worsen symptoms"],
            "followup": [
                "Repeat TSH and thyroid hormone panel per clinician guidance",
                "Medication adherence review at each follow-up",
            ],
        },
        "autism": {
            "diet": [
                "Maintain balanced nutrition and monitor selective eating patterns",
            ],
            "exercise": [
                "Encourage regular physical activity for mood and sleep regulation",
            ],
            "sleep": ["Use consistent bedtime routines to improve sleep quality"],
            "stress": [
                "Use sensory-friendly routines and behavioral support plans",
                "Provide caregiver support and respite planning when needed",
            ],
            "followup": [
                "Schedule periodic developmental and behavioral evaluations",
                "Coordinate speech/occupational therapy follow-ups when indicated",
            ],
        },
    }

    def generate(self, patient_data: dict[str, Any]) -> dict[str, Any]:
        """Generate a prevention plan based on patient diagnoses and risk factors."""
        diagnoses = patient_data.get("diagnoses", [])
        risk_factors = patient_data.get("riskFactors", [])

        diet: list[str] = []
        exercise: list[str] = []
        sleep: list[str] = []
        stress: list[str] = []
        followup: list[str] = []

        for diagnosis in diagnoses:
            key = diagnosis.lower().strip()
            key = self.DIAGNOSIS_ALIASES.get(key, key)
            recs = self.DISEASE_RECOMMENDATIONS.get(key, {})
            diet.extend(recs.get("diet", []))
            exercise.extend(recs.get("exercise", []))
            sleep.extend(recs.get("sleep", []))
            stress.extend(recs.get("stress", []))
            followup.extend(recs.get("followup", []))

        for factor in risk_factors:
            key = factor.lower().strip().replace(" ", "_")
            recs = self.RISK_FACTOR_RECOMMENDATIONS.get(key, {})
            diet.extend(recs.get("diet", []))
            exercise.extend(recs.get("exercise", []))
            sleep.extend(recs.get("sleep", []))
            stress.extend(recs.get("stress", []))
            followup.extend(recs.get("followup", []))

        # Default recommendations if no disease-specific ones found
        if not diet:
            diet = ["Maintain a balanced diet rich in vegetables, fruits, and lean proteins"]
        if not exercise:
            exercise = ["30 minutes of moderate exercise 5 days per week"]
        if not sleep:
            sleep = ["Aim for 7-9 hours of quality sleep nightly"]
        if not stress:
            stress = ["Practice mindfulness or meditation daily"]
        if not followup:
            followup = ["Schedule regular health check-ups every 6 months"]

        # Deduplicate
        return {
            "dietGuidance": list(dict.fromkeys(diet)),
            "exercisePlan": list(dict.fromkeys(exercise)),
            "sleepAdvice": list(dict.fromkeys(sleep)),
            "stressManagement": list(dict.fromkeys(stress)),
            "followUpTests": list(dict.fromkeys(followup)),
            "additionalNotes": f"Plan generated for diagnoses: {', '.join(diagnoses) or 'general wellness'}. "
            f"Risk factors considered: {', '.join(risk_factors) or 'none identified'}.",
        }


prevention_plan_service = PreventionPlanService()
