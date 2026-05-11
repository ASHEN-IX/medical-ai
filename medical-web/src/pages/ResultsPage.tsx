"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ModelResultCard from "@/components/ModelResultCard";
import RiskCard from "@/components/RiskCard";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import {
  formatDateTime,
  formatModelName,
  priorityBadgeClass,
  formatConfidence,
  riskProgressValue,
} from "@/utils/formatters";

const CORE_MODELS = ["diabetes", "heart", "kidney", "stroke"];
const AUTISM_MODELS = ["autism_pred", "autism_dl"];

const AUTISM_RECOMMENDATIONS = [
  "Refer the child to a pediatric neurodevelopmental specialist for a formal diagnostic assessment.",
  "Continue early-intervention support while awaiting evaluation results.",
  "Consider speech and language assessment if communication delay is present.",
  "Track social interaction, play behavior, and repetitive movements over time and share them with the clinician.",
];

const AUTISM_FOLLOW_UP_QUESTIONS = [
  "Does the child consistently respond when their name is called?",
  "Does the child use pointing, gestures, or eye contact to share interest?",
  "Does the child engage in pretend play or social back-and-forth play?",
  "Have language milestones or daily communication skills been delayed?",
  "Are repetitive movements, restricted interests, or sensory sensitivities present?",
];

function isAutismFocused(selectedModels: string[]): boolean {
  return selectedModels.some((modelName) => AUTISM_MODELS.includes(modelName));
}

function getAutismDecision(activeAnalysis: any): { autismDetected: boolean; autismProbability: number | null } {
  const autismPred = activeAnalysis?.response?.model_outputs?.autism_pred;
  const autismDl = activeAnalysis?.response?.model_outputs?.autism_dl;
  const autismDetails = autismPred?.raw_response?.prediction || autismDl?.raw_response?.prediction;

  const autismDetected = typeof autismDetails?.autism_detected === "boolean"
    ? autismDetails.autism_detected
    : typeof autismPred?.autism_detected === "boolean"
      ? autismPred.autism_detected
      : typeof autismDl?.autism_detected === "boolean"
        ? autismDl.autism_detected
        : false;

  const autismProbability = typeof autismDetails?.autism_probability === "number"
    ? autismDetails.autism_probability
    : typeof autismPred?.confidence === "number"
      ? autismPred.confidence
      : typeof autismDl?.confidence === "number"
        ? autismDl.confidence
        : null;

  return { autismDetected, autismProbability };
}

function getDetectedCondition(selectedModels: string[], overallRisk: string): string {
  if (selectedModels.includes("autism_pred") || selectedModels.includes("autism_dl")) {
    return "Autism Spectrum Screening";
  }

  if (selectedModels.includes("stroke")) {
    return "Stroke Risk Review";
  }

  if (selectedModels.includes("kidney")) {
    return "Kidney Disease Risk Review";
  }

  if (selectedModels.includes("heart")) {
    return "Cardiometabolic Risk Review";
  }

  if (selectedModels.includes("diabetes")) {
    return "Diabetes Risk Review";
  }

  return overallRisk === "HIGH" ? "Clinical Review" : "Monitoring Summary";
}

function buildClinicalSummary(selectedModels: string[], overallRisk: string, finalDecision: string): string {
  if (isAutismFocused(selectedModels)) {
    return "Screening pattern is consistent with autism spectrum features. This result supports follow-up evaluation and does not replace a clinical diagnosis.";
  }

  if (overallRisk === "HIGH") {
    return "The analysis indicates a high-risk pattern that warrants prompt clinician review and closer follow-up.";
  }

  if (overallRisk === "MEDIUM") {
    return "The analysis shows a moderate-risk pattern. Clinical review and preventive monitoring are recommended.";
  }

  if (finalDecision) {
    return `The analysis supports ${finalDecision.toLowerCase().replace(/_/g, " ")}.`;
  }

  return "The analysis does not show a strong disease signal, but routine monitoring is still appropriate.";
}

function buildRecommendations(selectedModels: string[], overallRisk: string, finalDecision: string): string[] {
  if (isAutismFocused(selectedModels)) {
    return AUTISM_RECOMMENDATIONS;
  }

  if (overallRisk === "HIGH") {
    return [
      "Arrange a prompt clinical review to confirm findings and plan next steps.",
      "Repeat or expand testing if symptoms are progressing or new symptoms appear.",
      "Review lifestyle, medication, and family history with the treating clinician.",
    ];
  }

  if (overallRisk === "MEDIUM") {
    return [
      "Schedule a follow-up visit to review risk factors and trends over time.",
      "Monitor for new symptoms and document any changes in the report history.",
      "Use the result as a screening aid, not a final diagnosis.",
    ];
  }

  return [
    "Continue routine monitoring and re-evaluate if symptoms change.",
    "Share this result with a qualified clinician if there are ongoing concerns.",
    finalDecision ? `Current gateway decision: ${finalDecision}.` : "No urgent abnormality was identified in this scan.",
  ];
}

function buildFollowUpQuestions(selectedModels: string[], overallRisk: string): string[] {
  if (isAutismFocused(selectedModels)) {
    return AUTISM_FOLLOW_UP_QUESTIONS;
  }

  if (selectedModels.includes("stroke")) {
    return [
      "Did the symptoms start suddenly or gradually?",
      "Is there facial droop, speech difficulty, arm weakness, or vision loss?",
      "Does the person have a history of hypertension, diabetes, or smoking?",
      "Have the symptoms improved, stayed the same, or worsened?",
    ];
  }

  if (selectedModels.includes("kidney")) {
    return [
      "Has there been swelling, reduced urine output, or foamy urine?",
      "Are creatinine, eGFR, or blood pressure values changing over time?",
      "Has the patient had diabetes, hypertension, or dehydration recently?",
      "Any medication changes that could affect kidney function?",
    ];
  }

  if (overallRisk === "HIGH") {
    return [
      "When did the symptoms begin and how quickly are they changing?",
      "What background conditions or medications could be contributing?",
      "Are there any red-flag symptoms that require urgent care?",
    ];
  }

  return [
    "What symptoms or concerns prompted this scan?",
    "Have any related measurements changed recently?",
    "Is there a family history or prior diagnosis that could explain the findings?",
  ];
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resultId = searchParams?.get("id") || null;

  const { currentAnalysis, history, openHistoryItem, setCurrentAnalysis } = useAIAnalysis();
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    const hydrateResult = async () => {
      if (resultId) {
        if (currentAnalysis?.id === resultId) {
          return;
        }

        setLoadingResult(true);
        await openHistoryItem(resultId);
        setLoadingResult(false);
        return;
      }

      if (!currentAnalysis && history.length > 0) {
        setCurrentAnalysis(history[0]);
      }
    };

    void hydrateResult();
  }, [currentAnalysis?.id, history, openHistoryItem, resultId, setCurrentAnalysis]);

  const activeAnalysis = currentAnalysis;
  const response = activeAnalysis?.response ?? ({} as any);
  const detectedModels = response.selected_models || [];
  const autismFocused = isAutismFocused(detectedModels);
  const { autismDetected, autismProbability } = getAutismDecision(activeAnalysis);

  const orderedModels = useMemo(() => {
    if (!activeAnalysis) {
      return CORE_MODELS;
    }

    if (autismFocused) {
      return detectedModels.filter((modelName: string) => AUTISM_MODELS.includes(modelName));
    }

    return Array.from(new Set([...CORE_MODELS, ...detectedModels]));
  }, [activeAnalysis, autismFocused, detectedModels]);

  if (loadingResult) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 text-center text-slate-600 shadow-lg">
        Loading selected analysis report...
      </div>
    );
  }

  if (!activeAnalysis) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">No Analysis Selected</h1>
        <p className="mt-2 text-sm text-slate-600">Run a new medical analysis to view detailed AI decisions.</p>
        <button
          type="button"
          onClick={() => router.push("/upload")}
          className="mt-6 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const progressValue = riskProgressValue(response.final_assessment.overall_risk);

  const detectedCondition = autismFocused
    ? autismDetected
      ? "Autism: Positive"
      : "Autism: Negative"
    : getDetectedCondition(detectedModels, response.final_assessment.overall_risk);

  const clinicalSummary = autismFocused
    ? autismDetected
      ? "Screening pattern is consistent with autism spectrum features. Continue with follow-up questions and specialist referral as appropriate."
      : "No autism-like screening pattern detected. No autism-specific follow-up questions will be generated."
    : buildClinicalSummary(detectedModels, response.final_assessment.overall_risk, response.final_decision);

  const recommendations = autismFocused
    ? autismDetected
      ? AUTISM_RECOMMENDATIONS
      : []
    : buildRecommendations(detectedModels, response.final_assessment.overall_risk, response.final_decision);

  const followUpQuestions = autismFocused ? (autismDetected ? AUTISM_FOLLOW_UP_QUESTIONS : []) : buildFollowUpQuestions(detectedModels, response.final_assessment.overall_risk);
  const filteredRagContext = autismFocused
    ? response.rag_context.filter((item: string) => item.toLowerCase().includes("autism_spectrum_disorder"))
    : response.rag_context;

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(activeAnalysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medai-analysis-${activeAnalysis.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-cyan-100/30 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Clinical Intelligence Result</h1>
            <p className="mt-1 text-sm text-slate-600">Generated {formatDateTime(activeAnalysis.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Print
            </button>
            <button
              type="button"
              onClick={downloadJSON}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={() => router.push("/history")}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
            >
              View History
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RiskCard
          label="Overall Risk"
          value={response.final_assessment.overall_risk}
          risk={response.final_assessment.overall_risk}
          helperText="Aggregated from selected medical models"
        />

        <article className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{response.final_assessment.priority}</p>
          <span
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(
              response.final_assessment.priority
            )}`}
          >
            Clinical triage hint
          </span>
        </article>
      </div>

      <article className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Clinical Impression</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{detectedCondition}</h2>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(response.final_assessment.priority)}`}>
            {response.final_assessment.priority} priority
          </span>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">{clinicalSummary}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected Models</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {response.selected_models.length > 0
                ? response.selected_models.map((modelName: string) => formatModelName(modelName)).join(", ")
                : "None"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gateway Confidence</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {autismFocused && autismProbability !== null
                ? `${formatConfidence(autismProbability)} — ${autismDetected ? "ASD Detected" : "No ASD"}`
                : formatConfidence(response.results[detectedModels[0] || ""]?.confidence || 0.9)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Decision</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{response.final_decision || "STANDARD_MONITORING"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Risk Visualization</span>
          <span>{Math.round(progressValue * 100)}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-red-500 transition-all duration-700"
            style={{ width: `${Math.round(progressValue * 100)}%` }}
          />
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {orderedModels.map((modelName: string) => (
          <ModelResultCard 
            key={modelName} 
            modelName={modelName} 
            result={response.results[modelName]} 
            detail={response.model_outputs[modelName]}
          />
        ))}
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI Reasoning</h2>
        {response.reasoning.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {response.reasoning.map((reason: string, index: number) => (
              <li key={`${reason}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                {reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No explanation provided for this analysis run.</p>
        )}
      </article>

      {filteredRagContext.length > 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Supporting Clinical Evidence</h2>
          <p className="mt-1 text-sm text-slate-600">
            Retrieved clinical references and background evidence used to support the analysis.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {filteredRagContext.map((item: string, index: number) => (
              <li key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {autismFocused && !autismDetected ? null : (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {autismFocused
              ? autismDetected
                ? AUTISM_RECOMMENDATIONS.map((r, i) => (
                    <li key={`rec-${i}`} className="rounded-lg bg-slate-50 px-3 py-2">
                      {r}
                    </li>
                  ))
                : [
                    <li key="none" className="rounded-lg bg-slate-50 px-3 py-2">
                      No autism-specific recommendations.
                    </li>,
                  ]
              : recommendations.map((recommendation, index) => (
                  <li key={`${recommendation}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    {recommendation}
                  </li>
                ))}
          </ul>
        </article>
      )}

      {(autismFocused && !autismDetected) ? null : (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Follow-up Questions</h2>
          <p className="mt-1 text-sm text-slate-600">Use these questions to understand possible causes and context for the detected pattern.</p>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {followUpQuestions.map((question, index) => (
              <li key={`${question}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="mr-2 font-semibold text-cyan-700">Q{index + 1}.</span>
                {question}
              </li>
            ))}
          </ol>
        </article>
      )}

      {response.kg_insights.connections.length > 0 ? (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Knowledge Graph Insights</h2>
          <p className="mt-3 text-sm text-slate-700">{response.kg_insights.connections.slice(0, 10).join(" • ")}</p>
        </article>
      ) : null}

      {response.llm_explanation_text ? (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">LLM Explanation</h2>
          <p className="mt-3 text-sm text-slate-700">{response.llm_explanation_text}</p>
        </article>
      ) : null}

      {response.final_decision ? (
        <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Final Decision</h2>
          <p className="mt-3 text-sm font-semibold text-cyan-700">{response.final_decision}</p>
        </article>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Metadata</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <p>
            <span className="font-semibold">Selected Models:</span>{" "}
            {response.selected_models.length > 0
              ? response.selected_models.map((modelName: string) => formatModelName(modelName)).join(", ")
              : "None"}
          </p>
          <p>
            <span className="font-semibold">Processing Time:</span> {response.metadata.processing_time_ms} ms
          </p>
          <p>
            <span className="font-semibold">Gateway Timestamp:</span> {formatDateTime(response.metadata.timestamp)}
          </p>
        </div>
      </article>
    </section>
  );
}
