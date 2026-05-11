from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.knowledge_graph.kg_schema import KnowledgeGraphContext, KnowledgeGraphProfile
from app.models.session_schema import FollowUpQuestion
from app.services.kg_client import KGClient, KGClientError
from app.services.rag_client import RAGClient, RAGClientError

try:
    from groq import Groq
except ImportError:
    Groq = None


logger = logging.getLogger(__name__)

RISK_THRESHOLDS = {"HIGH": 0.65, "MEDIUM": 0.45}

DISEASE_QUESTION_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "autism": [
        {"category": "social", "topic": "response_to_name", "text": "Does the child consistently respond when their name is called?", "priority": 9},
        {"category": "social", "topic": "joint_attention", "text": "Does the child use pointing, gestures, or eye contact to share interest?", "priority": 9},
        {"category": "play", "topic": "pretend_play", "text": "Does the child engage in pretend play or social back-and-forth play?", "priority": 8},
        {"category": "development", "topic": "language_delay", "text": "Have language milestones or daily communication skills been delayed?", "priority": 8},
        {"category": "behavior", "topic": "repetitive_or_sensory", "text": "Are repetitive movements, restricted interests, or sensory sensitivities present?", "priority": 8},
    ],
    "heart_disease": [
        {"category": "symptom", "topic": "chest_pain", "text": "Do you experience chest pain or tightness during physical activity or at rest?", "priority": 9},
        {"category": "symptom", "topic": "shortness_of_breath", "text": "Do you experience shortness of breath when climbing stairs, walking, or lying down?", "priority": 8},
        {"category": "risk_factor", "topic": "smoking", "text": "Do you currently smoke or have you smoked regularly in the past?", "priority": 8},
        {"category": "history", "topic": "family_heart", "text": "Has anyone in your immediate family (parent, sibling) been diagnosed with heart disease before age 55?", "priority": 7},
        {"category": "medication", "topic": "bp_medication", "text": "Are you currently taking medication for blood pressure, and if so, is it well controlled?", "priority": 7},
        {"category": "medication", "topic": "statins", "text": "Are you currently taking statin medication for cholesterol management?", "priority": 6},
        {"category": "lifestyle", "topic": "activity_tolerance", "text": "How would you describe your typical physical activity level — sedentary, lightly active, moderately active, or very active?", "priority": 6, "answer_type": "multiple_choice", "options": ["Sedentary", "Lightly active", "Moderately active", "Very active"]},
        {"category": "symptom", "topic": "palpitations", "text": "Do you experience heart palpitations, irregular heartbeat, or dizziness?", "priority": 5},
    ],
    "diabetes": [
        {"category": "symptom", "topic": "polyuria", "text": "Have you noticed frequent urination, especially at night?", "priority": 9},
        {"category": "symptom", "topic": "polydipsia", "text": "Do you experience excessive thirst throughout the day?", "priority": 8},
        {"category": "symptom", "topic": "weight_change", "text": "Have you experienced unexplained weight loss or gain in the past few months?", "priority": 7},
        {"category": "history", "topic": "family_diabetes", "text": "Has anyone in your immediate family been diagnosed with Type 1 or Type 2 diabetes?", "priority": 7},
        {"category": "lifestyle", "topic": "diet", "text": "How would you describe your typical diet — high in processed/sugary foods, balanced, or primarily whole foods?", "priority": 6, "answer_type": "multiple_choice", "options": ["High in processed/sugary foods", "Balanced", "Primarily whole foods"]},
        {"category": "symptom", "topic": "vision", "text": "Have you noticed any blurring of vision or difficulty focusing recently?", "priority": 6},
        {"category": "medication", "topic": "insulin", "text": "Are you currently using insulin or any oral diabetes medication?", "priority": 5},
        {"category": "symptom", "topic": "wound_healing", "text": "Do you notice that cuts or wounds take unusually long to heal?", "priority": 5},
    ],
    "kidney_disease": [
        {"category": "symptom", "topic": "swelling", "text": "Have you noticed swelling in your legs, ankles, feet, or around your eyes?", "priority": 9},
        {"category": "symptom", "topic": "urine_changes", "text": "Have you noticed changes in urination — foamy urine, blood in urine, or reduced output?", "priority": 9},
        {"category": "symptom", "topic": "fatigue", "text": "Do you experience persistent fatigue or difficulty concentrating?", "priority": 7},
        {"category": "history", "topic": "kidney_history", "text": "Have you previously been diagnosed with any kidney condition, urinary tract infections, or kidney stones?", "priority": 7},
        {"category": "risk_factor", "topic": "nsaid_use", "text": "Do you regularly use over-the-counter pain medications such as ibuprofen or naproxen?", "priority": 6},
        {"category": "risk_factor", "topic": "hypertension", "text": "Have you been diagnosed with high blood pressure, and if so, is it currently managed?", "priority": 8},
        {"category": "lifestyle", "topic": "hydration", "text": "How much water do you typically drink per day?", "priority": 5},
    ],
    "stroke": [
        {"category": "symptom", "topic": "neuro_symptoms", "text": "Have you experienced sudden numbness, weakness, or tingling on one side of the body?", "priority": 9},
        {"category": "symptom", "topic": "speech", "text": "Have you had episodes of slurred speech, difficulty finding words, or confusion?", "priority": 9},
        {"category": "symptom", "topic": "vision_loss", "text": "Have you experienced sudden vision loss or double vision in one or both eyes?", "priority": 8},
        {"category": "history", "topic": "tia", "text": "Have you ever been told you had a mini-stroke (transient ischemic attack / TIA)?", "priority": 8},
        {"category": "risk_factor", "topic": "afib", "text": "Have you been diagnosed with atrial fibrillation or any irregular heart rhythm?", "priority": 7},
        {"category": "medication", "topic": "blood_thinners", "text": "Are you currently taking blood-thinning medication (anticoagulants)?", "priority": 7},
        {"category": "lifestyle", "topic": "alcohol", "text": "How many alcoholic drinks do you consume on a typical week?", "priority": 6},
    ],
    "liver_disease": [
        {"category": "symptom", "topic": "jaundice", "text": "Have you noticed yellowing of your skin or the whites of your eyes?", "priority": 9},
        {"category": "symptom", "topic": "abdominal_pain", "text": "Do you experience pain or discomfort in the upper right side of your abdomen?", "priority": 8},
        {"category": "lifestyle", "topic": "alcohol", "text": "How often do you consume alcohol, and roughly how many drinks per session?", "priority": 8},
        {"category": "history", "topic": "hepatitis", "text": "Have you ever been diagnosed with or exposed to hepatitis B or C?", "priority": 8},
        {"category": "medication", "topic": "liver_meds", "text": "Are you taking any medications known to affect the liver, including supplements or herbal remedies?", "priority": 7},
        {"category": "history", "topic": "liver_disease_prior", "text": "Have you previously been diagnosed with fatty liver disease, cirrhosis, or any other liver condition?", "priority": 7},
        {"category": "symptom", "topic": "dark_urine", "text": "Have you noticed dark-coloured urine or pale/clay-coloured stools?", "priority": 6},
    ],
}

MODEL_TO_DISEASE_KEY = {
    "autism": "autism",
    "autism_pred": "autism",
    "autism_dl": "autism",
    "heart": "heart_disease",
    "diabetes": "diabetes",
    "kidney": "kidney_disease",
    "kidney_disease": "kidney_disease",
    "stroke": "stroke",
    "liver": "liver_disease",
    "liver_disease": "liver_disease",
}


class QuestionGenerator:
    def __init__(
        self,
        kg_client: KGClient | None = None,
        rag_client: RAGClient | None = None,
    ) -> None:
        self.kg_client = kg_client or KGClient()
        self.rag_client = rag_client or RAGClient()

    async def generate_questions(
        self,
        predicted_disease: str,
        confidence: float,
        overall_risk: str,
        features: Dict[str, Any],
        symptoms: List[str],
        model_outputs: Dict[str, Any],
        max_questions: int = 7,
        min_questions: int = 3,
    ) -> List[FollowUpQuestion]:
        if not self._exceeds_threshold(overall_risk, confidence):
            return []

        disease_key = MODEL_TO_DISEASE_KEY.get(predicted_disease.lower().replace(" ", "_"), predicted_disease.lower().replace(" ", "_"))

        # Parallel data fetching
        kg_task = asyncio.create_task(self._fetch_kg_profile(disease_key))
        rag_task = asyncio.create_task(self._fetch_rag_hints(disease_key, features, symptoms))

        kg_profile, rag_hints = await asyncio.gather(kg_task, rag_task, return_exceptions=True)

        if isinstance(kg_profile, Exception):
            logger.warning("KG profile unavailable for question gen: %s", kg_profile)
            kg_profile = KnowledgeGraphProfile(disease=disease_key)
        if isinstance(rag_hints, Exception):
            logger.warning("RAG hints unavailable for question gen: %s", rag_hints)
            rag_hints = []

        # 1. Try Adaptive LLM Generation first
        adaptive_questions = await self._generate_adaptive_llm_questions(
            disease_key, confidence, overall_risk, features, symptoms, kg_profile, rag_hints
        )

        if adaptive_questions:
            return adaptive_questions[:max_questions]

        # 2. Fallback to Template + KG Logic
        template_questions = self._get_template_questions(disease_key)
        filtered = self._filter_redundant(template_questions, features, symptoms)
        kg_augmented = self._augment_from_kg(filtered, kg_profile, rag_hints, disease_key)

        kg_augmented.sort(key=lambda q: q.priority, reverse=True)

        capped = kg_augmented[:max_questions]
        if len(capped) < min_questions:
            capped = kg_augmented[:min_questions]

        for i, q in enumerate(capped):
            if not q.id:
                q.id = f"q_{uuid4().hex[:8]}"

        return capped

    async def _generate_adaptive_llm_questions(
        self,
        disease: str,
        confidence: float,
        risk: str,
        features: Dict[str, Any],
        symptoms: List[str],
        kg_profile: KnowledgeGraphProfile,
        rag_hints: List[str]
    ) -> Optional[List[FollowUpQuestion]]:
        """Uses LLM to reason about uncertainty and generate branching questions."""
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key or not Groq:
            return None

        try:
            client = Groq(api_key=api_key)
            
            prompt = f"""
            System: You are an expert clinical diagnostic reasoner.
            Current Case:
            - Suspected Disease: {disease}
            - Confidence: {confidence:.2f}
            - Overall Risk: {risk}
            - Key Features: {json.dumps(features)}
            - Reported Symptoms: {symptoms}
            - KG Knowledge: {kg_profile.dict() if hasattr(kg_profile, 'dict') else str(kg_profile)}
            - Clinical Hints: {rag_hints}

            Task: Identify the TOP {5} most critical missing pieces of information needed to confirm this diagnosis or rule out alternatives.
            Generate questions that follow a logical branching structure.
            Return ONLY a JSON array of objects with fields: [text, category, reason, priority, answer_type, options].
            """

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model="mixtral-8x7b-32768",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            data = json.loads(response.choices[0].message.content)
            llm_questions = data.get("questions", data.get("array", []))
            if not isinstance(llm_questions, list):
                return None

            return [
                FollowUpQuestion(
                    id=f"q_llm_{uuid4().hex[:6]}",
                    text=q["text"],
                    disease=disease,
                    category=q.get("category", "adaptive"),
                    reason=q.get("reason", "Reasoning generated by clinical AI"),
                    priority=q.get("priority", 8),
                    answer_type=q.get("answer_type", "free_text"),
                    options=q.get("options", [])
                )
                for q in llm_questions
            ]
        except Exception as e:
            logger.error("Adaptive LLM question generation failed: %s", e)
            return None

    def _exceeds_threshold(self, overall_risk: str, confidence: float) -> bool:
        risk_upper = overall_risk.strip().upper()
        if risk_upper == "HIGH":
            return True
        if risk_upper == "MEDIUM" and confidence >= RISK_THRESHOLDS["MEDIUM"]:
            return True
        return confidence >= RISK_THRESHOLDS["HIGH"]

    def _get_template_questions(self, disease_key: str) -> List[FollowUpQuestion]:
        templates = DISEASE_QUESTION_TEMPLATES.get(disease_key, [])
        questions = []
        for tmpl in templates:
            questions.append(FollowUpQuestion(
                id=f"q_{uuid4().hex[:8]}",
                text=tmpl["text"],
                disease=disease_key,
                category=tmpl["category"],
                reason=f"Assessing {tmpl['category']} related to {disease_key.replace('_', ' ')}",
                answer_type=tmpl.get("answer_type", "free_text"),
                options=tmpl.get("options", []),
                priority=tmpl.get("priority", 5),
            ))
        return questions

    def _filter_redundant(
        self,
        questions: List[FollowUpQuestion],
        features: Dict[str, Any],
        symptoms: List[str],
    ) -> List[FollowUpQuestion]:
        symptoms_lower = {s.lower() for s in symptoms}
        feature_keys = {k.lower() for k in features}

        filtered: List[FollowUpQuestion] = []
        for q in questions:
            topic = q.text.lower()

            if q.category == "risk_factor" and "smoking" in topic and "smoking_status" in feature_keys:
                continue
            if q.category == "risk_factor" and "hypertension" in topic and "blood_pressure" in feature_keys:
                bp = features.get("blood_pressure")
                if isinstance(bp, (int, float)) and bp > 0:
                    continue

            if any(symptom in topic for symptom in symptoms_lower if len(symptom) > 4):
                q.priority = max(0, q.priority - 3)

            filtered.append(q)
        return filtered

    def _augment_from_kg(
        self,
        questions: List[FollowUpQuestion],
        kg_profile: KnowledgeGraphProfile,
        rag_hints: List[str],
        disease_key: str,
    ) -> List[FollowUpQuestion]:
        existing_topics = {q.text.lower()[:40] for q in questions}

        kg_symptoms = kg_profile.symptoms or []
        kg_risk_factors = kg_profile.risk_factors or []

        for symptom in kg_symptoms[:5]:
            snippet = symptom.lower()[:40]
            if any(snippet in topic for topic in existing_topics):
                continue
            questions.append(FollowUpQuestion(
                id=f"q_{uuid4().hex[:8]}",
                text=f"Have you experienced {symptom.lower()}?",
                disease=disease_key,
                category="symptom",
                reason=f"Knowledge graph identifies '{symptom}' as a symptom of {disease_key.replace('_', ' ')}",
                answer_type="yes_no",
                priority=4,
                kg_source=symptom,
            ))

        for rf in kg_risk_factors[:3]:
            snippet = rf.lower()[:40]
            if any(snippet in topic for topic in existing_topics):
                continue
            questions.append(FollowUpQuestion(
                id=f"q_{uuid4().hex[:8]}",
                text=f"Do you have a history of or exposure to {rf.lower()}?",
                disease=disease_key,
                category="risk_factor",
                reason=f"Knowledge graph identifies '{rf}' as a risk factor for {disease_key.replace('_', ' ')}",
                answer_type="yes_no",
                priority=3,
                kg_source=rf,
            ))

        for i, hint in enumerate(rag_hints[:3]):
            for q in questions:
                if q.rag_source is None:
                    q.rag_source = hint
                    break

        return questions

    async def _fetch_kg_profile(self, disease_key: str) -> KnowledgeGraphProfile:
        try:
            ctx = await asyncio.to_thread(self.kg_client.get_context_for_models, [disease_key])
            if ctx.source_profiles:
                return ctx.source_profiles[0]
            return KnowledgeGraphProfile(
                disease=disease_key,
                symptoms=ctx.symptoms,
                risk_factors=ctx.risk_factors,
                complications=ctx.complications,
                treatments=ctx.treatments,
            )
        except KGClientError as exc:
            logger.warning("KG fetch failed for question gen disease=%s error=%s", disease_key, exc)
            return KnowledgeGraphProfile(disease=disease_key)

    async def _fetch_rag_hints(
        self,
        disease_key: str,
        features: Dict[str, Any],
        symptoms: List[str],
    ) -> List[str]:
        query = f"{disease_key.replace('_', ' ')} clinical assessment follow-up questions"
        if symptoms:
            query += " " + " ".join(symptoms[:3])

        try:
            return await asyncio.to_thread(self.rag_client.retrieve_context, query, 3)
        except RAGClientError as exc:
            logger.warning("RAG fetch failed for question gen error=%s", exc)
            return []
