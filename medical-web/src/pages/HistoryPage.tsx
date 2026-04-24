"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import type { RiskLevel } from "@/services/api";
import { formatDateTime } from "@/utils/formatters";

export default function HistoryPage() {
  const router = useRouter();
  const { history, refreshHistory } = useAIAnalysis();

  const [dateFilter, setDateFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      const createdDate = entry.createdAt.slice(0, 10);
      const overallRisk = entry.response.final_assessment.overall_risk;

      const dateMatches = !dateFilter || createdDate === dateFilter;
      const riskMatches = riskFilter === "ALL" || riskFilter === overallRisk;

      return dateMatches && riskMatches;
    });
  }, [dateFilter, history, riskFilter]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-cyan-100/30 backdrop-blur">
        <h1 className="text-3xl font-semibold text-slate-900">Analysis History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review previous AI runs and reopen full clinical intelligence responses.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:w-[420px]">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Filter by date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Filter by risk</span>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskLevel | "ALL")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="ALL">ALL</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </label>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">No historical analysis matched your filters.</p>
          <button
            type="button"
            onClick={() => router.push("/upload")}
            className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Run New Analysis
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((entry) => (
            <button
              type="button"
              key={entry.id}
              onClick={() => router.push(`/results?id=${entry.id}`)}
              className="w-full rounded-2xl border border-slate-200 bg-white/85 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatDateTime(entry.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Models: {entry.response.selected_models.join(", ") || "none"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Risk: {entry.response.final_assessment.overall_risk}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Priority: {entry.response.final_assessment.priority}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
