from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import httpx

from app.utils.risk_aggregator import normalize_risk


logger = logging.getLogger(__name__)


@dataclass
class ModelPrediction:
    model: str
    risk: str
    confidence: float
    source: str
    success: bool = True
    error: str | None = None
    raw_response: dict[str, Any] | None = None


@dataclass
class _RequestResult:
    ok: bool
    status_code: int | None
    payload: dict[str, Any] | None = None
    error: str | None = None


class ModelClient:
    """Abstraction layer for invoking internal model endpoints with retries/timeouts."""

    DEFAULT_ENDPOINTS = {
        "diabetes": ["/api/v1/diabetes/predict", "/api/v1/diabetes-risk/predict"],
        "heart": ["/api/v1/heart/predict", "/api/v1/heart-disease/predict"],
        "kidney": ["/api/v1/kidney-disease/predict"],
        "stroke": ["/api/v1/stroke/predict", "/api/v1/stroke-risk/predict"],
        "autism_dl": ["/api/v1/autism-dl/predict"],
        "autism_pred": ["/api/v1/autism-pred/predict"],
        "liver": ["/api/v1/liver-disease/predict", "/api/v1/liver/predict"],
    }

    KIDNEY_DEFAULT_PAYLOAD = {
        "age": 50,
        "hemo": 13.5,
        "sg": 1.02,
        "al": 0,
        "pcv": 40,
        "sc": 1.0,
        "htn": 0,
    }

    def __init__(
        self,
        base_url: str | None = None,
        timeout_seconds: float = 8.0,
        max_retries: int = 2,
    ) -> None:
        self.base_url = (base_url or os.getenv("AI_GATEWAY_INTERNAL_BASE_URL", "http://127.0.0.1:8001")).rstrip("/")
        self.timeout_seconds = float(os.getenv("AI_GATEWAY_MODEL_TIMEOUT_SECONDS", timeout_seconds))
        self.max_retries = int(os.getenv("AI_GATEWAY_MODEL_MAX_RETRIES", max_retries))
        self.internal_mode = os.getenv("AI_GATEWAY_INTERNAL_MODE", "asgi").strip().lower()

    async def predict_diabetes(self, features: Mapping[str, Any], request_id: str) -> ModelPrediction:
        return await self._predict_model("diabetes", features, request_id)

    async def predict_heart(self, features: Mapping[str, Any], request_id: str) -> ModelPrediction:
        return await self._predict_model("heart", features, request_id)

    async def predict_kidney(self, features: Mapping[str, Any], request_id: str) -> ModelPrediction:
        payload = self._build_kidney_payload(features)
        return await self._predict_model("kidney", payload, request_id, payload_only=[payload])

    async def predict_stroke(
        self,
        features: Mapping[str, Any],
        request_id: str,
        symptoms: Sequence[str] | None = None,
    ) -> ModelPrediction:
        payload_overrides = {"symptoms": list(symptoms or [])}
        return await self._predict_model("stroke", features, request_id, payload_overrides=payload_overrides)

    async def predict_autism_dl(self, image_base64: str, request_id: str) -> ModelPrediction:
        payload = {
            "image": image_base64,
            "image_format": "jpg",
            "model_version": "v1.0",
            "return_heatmap": False,
        }
        return await self._predict_model("autism_dl", {"image": image_base64}, request_id, payload_only=[payload])

    async def predict_autism_pred(self, features: Mapping[str, Any], request_id: str) -> ModelPrediction:
        # The autism prediction endpoint expects nested survey responses and demographics.
        # Staged analysis often provides a flat feature map, so we adapt it here.
        responses = dict(features.get("responses") or {})
        if not responses:
            responses = {
                f"A{i}_Score": features.get(f"A{i}_Score", 0)
                for i in range(1, 11)
            }

        demographics = dict(features.get("demographics") or {})
        if not demographics:
            demographics = {
                "gender": features.get("gender", "m"),
                "age": features.get("age"),
                "ethnicity": features.get("ethnicity"),
                "jaundice": features.get("jaundice"),
                "austim": features.get("austim"),
                "contry_of_res": features.get("contry_of_res"),
                "used_app_before": features.get("used_app_before"),
                "result": features.get("result"),
                "relation": features.get("relation"),
            }
        # Normalize categorical values:
        # - empty strings -> None
        # - non-numeric country codes -> 'Unknown' (model expects numeric codes or 'Unknown')
        for _col in ("gender", "ethnicity", "jaundice", "austim", "contry_of_res", "used_app_before", "relation"):
            val = demographics.get(_col)
            if isinstance(val, str) and not val.strip():
                demographics[_col] = None
                continue
            if _col == "contry_of_res" and isinstance(val, str):
                stripped = val.strip()
                # If the value is not a numeric code, map to 'Unknown' which the encoder accepts
                if not stripped.isdigit():
                    demographics[_col] = "Unknown"
                    continue
                # keep numeric string as-is (encoder expects numeric codes)
                demographics[_col] = stripped

        if demographics.get("result") is None:
            demographics["result"] = float(sum(int(responses.get(f"A{i}_Score", 0) or 0) for i in range(1, 11)))

        payload = {
            "responses": responses,
            "demographics": demographics,
        }
        return await self._predict_model("autism_pred", features, request_id, payload_only=[payload])

    async def _predict_model(
        self,
        model_name: str,
        features: Mapping[str, Any],
        request_id: str,
        payload_overrides: Mapping[str, Any] | None = None,
        payload_only: list[dict[str, Any]] | None = None,
    ) -> ModelPrediction:
        endpoints = self._resolve_endpoints(model_name)
        payload_variants = payload_only or self._payload_variants(features, payload_overrides)
        headers = {"x-request-id": request_id}
        fallback_features = dict(features)
        if payload_overrides:
            fallback_features.update(dict(payload_overrides))

        last_error = "Downstream model did not return a usable response"
        for endpoint in endpoints:
            for payload in payload_variants:
                request_result = await self._post_with_retry(endpoint, payload, headers)
                if request_result.ok and request_result.payload is not None:
                    normalized = self._normalize_response(model_name, request_result.payload)
                    if normalized.success:
                        return normalized
                    if normalized.error:
                        last_error = normalized.error
                    continue

                if request_result.error:
                    last_error = request_result.error

                # For invalid payload shape, try the next payload variant before giving up.
                if request_result.status_code in {400, 422}:
                    continue

                # For endpoint not found, try the next endpoint candidate.
                if request_result.status_code == 404:
                    break

        logger.warning("Using fallback model estimation for %s: %s", model_name, last_error)
        return self._fallback_prediction(model_name, fallback_features, last_error)

    async def _post_with_retry(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        headers: Mapping[str, str],
    ) -> _RequestResult:
        last_error = "Unknown model client error"

        for attempt in range(1, self.max_retries + 2):
            try:
                async with self._build_client() as client:
                    response = await client.post(endpoint, json=payload, headers=dict(headers))

                if response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        message=f"Downstream server error ({response.status_code})",
                        request=response.request,
                        response=response,
                    )

                if response.status_code == 404:
                    return _RequestResult(ok=False, status_code=404, error=f"Endpoint not found: {endpoint}")

                if response.status_code >= 400:
                    return _RequestResult(
                        ok=False,
                        status_code=response.status_code,
                        error=self._extract_error_message(response),
                    )

                payload_json = response.json() if response.content else {}
                if not isinstance(payload_json, dict):
                    return _RequestResult(
                        ok=False,
                        status_code=response.status_code,
                        error="Model endpoint returned non-JSON response",
                    )

                return _RequestResult(ok=True, status_code=response.status_code, payload=payload_json)
            except httpx.TimeoutException:
                last_error = f"Request timeout after {self.timeout_seconds:.1f}s for {endpoint}"
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code if exc.response is not None else "unknown"
                last_error = f"Downstream HTTP error ({status_code}) for {endpoint}"
            except httpx.HTTPError as exc:
                last_error = f"Network error for {endpoint}: {exc}"
            except Exception as exc:  # pylint: disable=broad-except
                last_error = f"Unexpected model client error for {endpoint}: {exc}"

            if attempt <= self.max_retries:
                await asyncio.sleep(0.15 * attempt)

        return _RequestResult(ok=False, status_code=None, error=last_error)

    def _build_client(self) -> httpx.AsyncClient:
        timeout = httpx.Timeout(self.timeout_seconds)

        if self.internal_mode == "asgi":
            # Lazy import avoids FastAPI startup circular imports.
            from app.main import app as fastapi_app

            transport = httpx.ASGITransport(app=fastapi_app)
            return httpx.AsyncClient(transport=transport, base_url="http://ai-service.internal", timeout=timeout)

        return httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    def _resolve_endpoints(self, model_name: str) -> list[str]:
        env_key = f"AI_GATEWAY_{model_name.upper()}_ENDPOINTS"
        configured = os.getenv(env_key)
        if configured:
            endpoints = [segment.strip() for segment in configured.split(",") if segment.strip()]
            if endpoints:
                return endpoints
        return self.DEFAULT_ENDPOINTS.get(model_name, [])

    def _payload_variants(
        self,
        features: Mapping[str, Any],
        payload_overrides: Mapping[str, Any] | None,
    ) -> list[dict[str, Any]]:
        base_payload = dict(features)
        if payload_overrides:
            base_payload.update(dict(payload_overrides))

        return [
            base_payload,
            {"features": base_payload},
            {"data": base_payload},
        ]

    def _normalize_response(
        self,
        model_name: str,
        payload: Mapping[str, Any],
    ) -> ModelPrediction:
        if payload.get("success") is False:
            return ModelPrediction(
                model=model_name,
                risk="LOW",
                confidence=0.0,
                source="endpoint",
                success=False,
                error=self._first_non_empty(
                    payload.get("message"),
                    payload.get("error"),
                    str(payload.get("detail")) if payload.get("detail") is not None else None,
                )
                or "Model endpoint reported failure",
                raw_response=dict(payload),
            )

        prediction = payload.get("prediction") if isinstance(payload.get("prediction"), dict) else {}

        risk_candidate = self._first_non_empty(
            prediction.get("risk"),
            prediction.get("risk_level"),
            payload.get("risk"),
            payload.get("risk_level"),
        )

        confidence_candidate = self._first_float(
            prediction.get("confidence"),
            prediction.get("confidence_score"),
            prediction.get("probability"),
            payload.get("confidence"),
            payload.get("confidence_score"),
            payload.get("probability"),
        )

        if confidence_candidate is None:
            confidence_candidate = self._first_float(
                prediction.get("diabetes_probability"),
                prediction.get("heart_probability"),
                prediction.get("stroke_probability"),
                prediction.get("ckd_probability"),
            )

        if model_name == "autism_dl" and risk_candidate is None:
            autism_detected = prediction.get("autism_detected")
            if isinstance(autism_detected, bool):
                risk_candidate = "HIGH" if autism_detected else "LOW"

        normalized_risk = normalize_risk(risk_candidate, confidence_candidate)

        if confidence_candidate is None:
            confidence_candidate = self._default_confidence_for_risk(normalized_risk)

        confidence_candidate = max(0.0, min(1.0, float(confidence_candidate)))
        return ModelPrediction(
            model=model_name,
            risk=normalized_risk,
            confidence=round(confidence_candidate, 2),
            source="endpoint",
            success=True,
            raw_response=dict(payload),
        )

    def _fallback_prediction(
        self,
        model_name: str,
        features: Mapping[str, Any],
        error: str,
    ) -> ModelPrediction:
        if model_name == "diabetes":
            glucose = self._to_float(features.get("glucose"))
            if glucose is None:
                risk, confidence = "LOW", 0.56
            elif glucose >= 180:
                risk, confidence = "HIGH", 0.9
            elif glucose > 140:
                risk, confidence = "MEDIUM", 0.74
            else:
                risk, confidence = "LOW", 0.65
        elif model_name == "heart":
            blood_pressure = self._to_float(features.get("blood_pressure"))
            cholesterol = self._to_float(features.get("cholesterol"))
            score = 0
            if blood_pressure is not None and blood_pressure > 130:
                score += 1
            if cholesterol is not None and cholesterol > 200:
                score += 1

            if score >= 2:
                risk, confidence = "HIGH", 0.82
            elif score == 1:
                risk, confidence = "MEDIUM", 0.7
            else:
                risk, confidence = "LOW", 0.6
        elif model_name == "kidney":
            creatinine = self._to_float(features.get("creatinine"))
            blood_pressure = self._to_float(features.get("blood_pressure"))
            age = self._to_float(features.get("age"))
            score = 0

            if creatinine is not None and creatinine >= 1.5:
                score += 1
            if blood_pressure is not None and blood_pressure > 130:
                score += 1
            if age is not None and age >= 60:
                score += 1

            if score >= 2:
                risk, confidence = "HIGH", 0.82
            elif score == 1:
                risk, confidence = "MEDIUM", 0.7
            else:
                risk, confidence = "LOW", 0.6
        elif model_name == "stroke":
            age = self._to_float(features.get("age"))
            has_neuro = bool(features.get("neurological_symptoms")) or self._contains_neuro_symptoms(
                features.get("symptoms")
            )
            if has_neuro:
                risk, confidence = "HIGH", 0.78
            elif age is not None and age >= 60:
                risk, confidence = "MEDIUM", 0.65
            else:
                risk, confidence = "LOW", 0.58
        elif model_name == "autism_dl":
            risk, confidence = "LOW", 0.55
        elif model_name == "autism_pred":
            responses = features.get("responses")
            if isinstance(responses, Mapping):
                score_total = 0
                for idx in range(1, 11):
                    value = self._to_float(responses.get(f"A{idx}_Score"))
                    if value is not None and value >= 1:
                        score_total += 1

                if score_total >= 7:
                    risk, confidence = "HIGH", 0.84
                elif score_total >= 4:
                    risk, confidence = "MEDIUM", 0.72
                else:
                    risk, confidence = "LOW", 0.62
            else:
                risk, confidence = "LOW", 0.55
        else:
            risk, confidence = "LOW", 0.5

        return ModelPrediction(
            model=model_name,
            risk=risk,
            confidence=confidence,
            source="fallback",
            success=True,
            error=error,
        )

    def _extract_error_message(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
            if isinstance(payload, dict):
                detail = payload.get("detail")
                if isinstance(detail, dict):
                    return str(detail.get("details") or detail.get("message") or detail)
                if detail is not None:
                    return str(detail)
                message = payload.get("message") or payload.get("error")
                if message:
                    return str(message)
        except Exception:  # pylint: disable=broad-except
            pass

        return f"Model request failed with status {response.status_code}"

    def _first_non_empty(self, *values: Any) -> str | None:
        for value in values:
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    def _first_float(self, *values: Any) -> float | None:
        for value in values:
            converted = self._to_float(value)
            if converted is not None:
                return converted
        return None

    def _to_float(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _default_confidence_for_risk(self, risk: str) -> float:
        mapping = {
            "HIGH": 0.82,
            "MEDIUM": 0.66,
            "LOW": 0.58,
        }
        return mapping.get(normalize_risk(risk), 0.58)

    def _contains_neuro_symptoms(self, symptoms: Any) -> bool:
        if symptoms is None:
            return False

        if isinstance(symptoms, str):
            candidates = [symptoms.lower()]
        elif isinstance(symptoms, (list, tuple, set)):
            candidates = [str(item).strip().lower() for item in symptoms]
        else:
            return False

        keywords = {
            "slurred speech",
            "facial droop",
            "face droop",
            "arm weakness",
            "numbness",
            "confusion",
            "vision loss",
            "stroke",
        }
        return any(any(keyword in candidate for keyword in keywords) for candidate in candidates)

    def _build_kidney_payload(self, features: Mapping[str, Any]) -> dict[str, Any]:
        payload = dict(self.KIDNEY_DEFAULT_PAYLOAD)

        if (age := self._to_float(features.get("age"))) is not None:
            payload["age"] = age

        if (hemo := self._to_float(features.get("hemo"))) is not None:
            payload["hemo"] = hemo

        if (sg := self._to_float(features.get("sg"))) is not None:
            payload["sg"] = sg

        if (al := self._to_float(features.get("al"))) is not None:
            payload["al"] = int(round(al))

        if (pcv := self._to_float(features.get("pcv"))) is not None:
            payload["pcv"] = pcv

        sc_value = self._to_float(features.get("sc"))
        if sc_value is None:
            sc_value = self._to_float(features.get("creatinine"))
        if sc_value is not None:
            payload["sc"] = sc_value

        hypertension = features.get("htn")
        if isinstance(hypertension, (int, float)):
            payload["htn"] = 1 if float(hypertension) >= 1 else 0
        elif isinstance(hypertension, str):
            payload["htn"] = 1 if hypertension.strip().lower() in {"1", "true", "yes", "y"} else 0
        else:
            blood_pressure = self._to_float(features.get("blood_pressure"))
            if blood_pressure is not None:
                payload["htn"] = 1 if blood_pressure > 130 else 0

        return payload
