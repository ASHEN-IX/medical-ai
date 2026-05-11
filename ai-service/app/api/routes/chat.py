from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's question")
    analysis_context: Optional[dict] = Field(None, description="Current analysis data for context")
    history: Optional[list[ChatMessage]] = Field(default_factory=list, description="Conversation history")


class ChatResponse(BaseModel):
    response: str
    sources: list[str] = Field(default_factory=list)


def _build_system_prompt(context: dict | None) -> str:
    base = (
        "You are MedAI Nexus, a helpful medical AI assistant. "
        "You help patients understand their medical reports and results in simple language. "
        "Always remind users to consult a real doctor for medical decisions. "
        "Be empathetic, clear, and avoid medical jargon when possible."
    )
    if not context:
        return base

    risk = context.get("risk_level", context.get("riskLevel", "unknown"))
    score = context.get("health_score", context.get("healthScore", "N/A"))
    findings = context.get("key_findings", context.get("keyFindings", []))
    insights = context.get("ai_insights", context.get("aiInsights", ""))

    context_block = f"\n\nCurrent patient context:\n- Health Score: {score}\n- Risk Level: {risk}"
    if findings:
        context_block += f"\n- Key Findings: {', '.join(findings) if isinstance(findings, list) else findings}"
    if insights:
        context_block += f"\n- AI Insights: {insights}"

    return base + context_block


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(payload: ChatRequest, request: Request) -> ChatResponse:
    groq_key = os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    system_prompt = _build_system_prompt(payload.analysis_context)

    messages = [{"role": "system", "content": system_prompt}]

    if payload.history:
        for msg in payload.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": payload.message})

    try:
        if groq_key:
            from groq import Groq
            client = Groq(api_key=groq_key)
            completion = client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                messages=messages,
                max_tokens=1024,
                temperature=0.7,
            )
            response_text = completion.choices[0].message.content
        elif openai_key and not openai_key.startswith("sk-test"):
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                max_tokens=1024,
                temperature=0.7,
            )
            response_text = completion.choices[0].message.content
        else:
            # Mock Fallback for Demo
            response_text = (
                "DEMO MODE: I am currently operating without a live LLM connection. "
                "In a production environment, I would provide personalized medical insights based on your "
                f"risk level ({payload.analysis_context.get('risk_level', 'LOW') if payload.analysis_context else 'LOW'}). "
                "Please ensure valid API keys are configured in the .env file."
            )

        rag_sources: list[str] = []
        try:
            from app.services.medical_rag_service import medical_rag_service
            if medical_rag_service._is_ready:
                results = medical_rag_service.retrieve(payload.message, top_k=3)
                rag_sources = [r.get("text", "")[:200] for r in results if isinstance(r, dict)]
        except Exception:
            pass

        return ChatResponse(response=response_text or "", sources=rag_sources)

    except Exception as exc:
        logger.exception("Chat completion failed")
        raise HTTPException(
            status_code=500,
            detail={"code": "CHAT_FAILED", "message": "Failed to generate response", "details": str(exc)},
        ) from exc
