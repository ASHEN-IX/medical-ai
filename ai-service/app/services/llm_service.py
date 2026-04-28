from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Mapping

from groq import Groq
from pydantic import ValidationError

from app.models.llm_schema import LLMExplanationResponse
from app.services.llm_guardrails import build_safe_fallback_response, ensure_safe_explanation
from app.services.prompt_builder import build_explanation_messages


logger = logging.getLogger(__name__)


class LLMServiceError(RuntimeError):
    pass


class LLMService:
    def __init__(
        self,
        client: Groq | None = None,
        model_name: str | None = None,
        temperature: float = 0.3,
    ) -> None:
        self.model_name = model_name or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.temperature = temperature
        api_key = os.getenv("GROQ_API_KEY")
        self.client = client or Groq(api_key=api_key)

    async def generate_explanation(
        self,
        model_results: dict[str, Any],
        features: dict[str, Any],
        rag_context: list[str],
        request_id: str | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            self._generate_explanation_sync,
            model_results,
            features,
            rag_context,
            request_id,
        )

    def _generate_explanation_sync(
        self,
        model_results: dict[str, Any],
        features: dict[str, Any],
        rag_context: list[str],
        request_id: str | None,
    ) -> dict[str, Any]:
        if not os.getenv("GROQ_API_KEY"):
            raise LLMServiceError("GROQ_API_KEY is not configured")

        messages = build_explanation_messages(model_results, features, rag_context)
        logger.info(
            "LLM explanation request started request_id=%s model=%s model_result_keys=%s feature_keys=%s rag_chunks=%s",
            request_id,
            self.model_name,
            list(model_results.keys()),
            list(features.keys()),
            len(rag_context),
        )

        try:
            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=self.temperature,
                top_p=1,
                reasoning_effort="medium",
                max_completion_tokens=1200,
                response_format={"type": "json_object"},
            )
            raw_content = completion.choices[0].message.content or ""
            parsed_payload = self._parse_json_response(raw_content)
            response = LLMExplanationResponse.model_validate(parsed_payload)
            safe_response = ensure_safe_explanation(response, model_results, features, rag_context)
            payload = safe_response.model_dump(mode="json")
            logger.info(
                "LLM explanation request completed request_id=%s model=%s summary_chars=%s explanation_count=%s",
                request_id,
                self.model_name,
                len(payload.get("summary", "")),
                len(payload.get("explanation", [])),
            )
            return payload
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("LLM returned invalid structured output request_id=%s error=%s", request_id, exc)
            fallback = build_safe_fallback_response(model_results, features, rag_context)
            return fallback.model_dump(mode="json")
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("LLM explanation failed request_id=%s", request_id)
            raise LLMServiceError(str(exc)) from exc

    def _parse_json_response(self, raw_content: str) -> dict[str, Any]:
        stripped = raw_content.strip()
        if stripped.startswith("```"):
            stripped = self._strip_code_fence(stripped)
        return json.loads(stripped)

    def _strip_code_fence(self, content: str) -> str:
        lines = content.splitlines()
        if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].startswith("```"):
            return "\n".join(lines[1:-1]).strip()
        return content.strip("`").strip()
