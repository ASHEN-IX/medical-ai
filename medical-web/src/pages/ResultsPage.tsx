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
  riskProgressValue,
} from "@/utils/formatters";

const CORE_MODELS = ["diabetes", "heart", "stroke"];

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resultId = searchParams.get("id");

  const { currentAnalysis, history, openHistoryItem, setCurrentAnalysis } = useAIAnalysis();
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    const hydrateResult = async () => {
      if (resultId) {
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
  }, [currentAnalysis, history, openHistoryItem, resultId, setCurrentAnalysis]);

  const activeAnalysis = currentAnalysis;

  const orderedModels = useMemo(() => {
    if (!activeAnalysis) {
      return CORE_MODELS;
    }

    return Array.from(new Set([...CORE_MODELS, ...activeAnalysis.response.selected_models]));
  }, [activeAnalysis]);

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

  const { response } = activeAnalysis;
  const progressValue = riskProgressValue(response.final_assessment.overall_risk);

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
        {orderedModels.map((modelName) => (
          <ModelResultCard key={modelName} modelName={modelName} result={response.results[modelName]} />
        ))}
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI Reasoning</h2>
        {response.reasoning.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {response.reasoning.map((reason, index) => (
              <li key={`${reason}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                {reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No explanation provided for this analysis run.</p>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Metadata</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Selected Models:</span>{" "}
            {response.selected_models.length > 0
              ? response.selected_models.map((modelName) => formatModelName(modelName)).join(", ")
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
