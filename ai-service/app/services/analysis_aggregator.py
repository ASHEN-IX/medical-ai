from __future__ import annotations

from typing import Any, Mapping

from app.knowledge_graph.kg_schema import KnowledgeGraphContext
from app.models.gateway_schema import (
    AnalysisInputs,
    FinalAssessment,
    GatewayAnalyzeResponse,
    GatewayMetadata,
    GatewayModelDetail,
    GatewayModelResult,
    KnowledgeGraphInsights,
    RiskAssessment,
)
from app.models.llm_schema import LLMExplanationResponse
from app.services.model_orchestrator import OrchestrationResult
from app.utils.risk_aggregator import normalize_risk, priority_from_risk


class AnalysisResponseAggregator:
    def build_response(
        self,
        *,
        request_id: str,
        report_type: str,
        features: Mapping[str, Any],
        selected_models: list[str],
        orchestration_result: OrchestrationResult,
        rag_context: list[str],
        kg_context: KnowledgeGraphContext,
        llm_explanation: LLMExplanationResponse | None,
        metadata: GatewayMetadata,
        reasoning: list[str],
        include_explanation: bool,
        symptoms: list[str],
        has_image: bool,
        has_raw_text: bool,
    ) -> GatewayAnalyzeResponse:
        results = {
            model_name: GatewayModelResult(
                risk=str(payload.get("risk", "LOW")),
                confidence=float(payload.get("confidence", 0.0)),
            )
            for model_name, payload in orchestration_result.results.items()
        }

        model_outputs = {
            model_name: GatewayModelDetail(
                risk=prediction.risk,
                confidence=prediction.confidence,
                source=prediction.source,
                success=prediction.success,
                error=prediction.error,
                raw_response=prediction.raw_response,
            )
            for model_name, prediction in orchestration_result.details.items()
        }

        overall_risk = _overall_risk_from_results(results)
        priority = priority_from_risk(overall_risk)
        final_decision = self._final_decision_from_risk(overall_risk)

        kg_insights = KnowledgeGraphInsights(
            diseases=list(kg_context.diseases),
            symptoms=list(kg_context.symptoms),
            risk_factors=list(kg_context.risk_factors),
            complications=list(kg_context.complications),
            treatments=list(kg_context.treatments),
            connections=self._build_connections(kg_context),
        )

        llm_text = self._flatten_llm_explanation(llm_explanation) if llm_explanation else ""

        return GatewayAnalyzeResponse(
            success=True,
            request_id=request_id,
            inputs=AnalysisInputs(
                report_type=report_type,
                include_explanation=include_explanation,
                symptoms=list(symptoms),
                has_image=has_image,
                has_raw_text=has_raw_text,
            ),
            extracted_features=dict(features),
            model_outputs=model_outputs,
            rag_context=list(rag_context),
            kg_insights=kg_insights,
            risk_assessment=RiskAssessment(
                overall_risk=overall_risk,
                priority=priority,
                final_decision=final_decision,
                rationale=list(reasoning),
            ),
            llm_explanation_text=llm_text,
            final_decision=final_decision,
            selected_models=list(selected_models),
            results=results,
            final_assessment=FinalAssessment(overall_risk=overall_risk, priority=priority),
            reasoning=list(reasoning),
            llm_explanation=llm_explanation,
            metadata=metadata,
        )

    def _build_connections(self, context: KnowledgeGraphContext) -> list[str]:
        connections: list[str] = []
        for disease in context.diseases:
            for symptom in context.symptoms:
                connections.append(f"{disease} -> symptom -> {symptom}")
            for risk_factor in context.risk_factors:
                connections.append(f"{disease} -> risk_factor -> {risk_factor}")
            for complication in context.complications:
                connections.append(f"{disease} -> complication -> {complication}")
            for treatment in context.treatments:
                connections.append(f"{disease} -> treatment -> {treatment}")
        return connections[:60]

    def _flatten_llm_explanation(self, llm_explanation: LLMExplanationResponse | None) -> str:
        if llm_explanation is None:
            return ""

        parts = [llm_explanation.summary.strip()]
        parts.extend(item.strip() for item in llm_explanation.explanation if item.strip())
        parts.extend(item.strip() for item in llm_explanation.recommendations if item.strip())
        parts.append(llm_explanation.safety_note.strip())
        return " ".join(part for part in parts if part)

    def _final_decision_from_risk(self, risk: str) -> str:
        normalized = normalize_risk(risk)
        if normalized == "HIGH":
            return "ESCALATE_FOR_IMMEDIATE_REVIEW"
        if normalized == "MEDIUM":
            return "REVIEW_AND_MONITOR"
        return "STANDARD_MONITORING"


def _overall_risk_from_results(results: Mapping[str, GatewayModelResult]) -> str:
    if not results:
        return "LOW"

    levels = [normalize_risk(result.risk, result.confidence) for result in results.values()]
    if any(level == "HIGH" for level in levels):
        return "HIGH"
    if sum(1 for level in levels if level == "MEDIUM") >= 2:
        return "MEDIUM"
    if any(level == "MEDIUM" for level in levels):
        return "MEDIUM"
    return "LOW"
