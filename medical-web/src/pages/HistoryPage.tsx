"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import type { RiskLevel } from "@/services/api";

const RISK_COLORS: Record<string, string> = {
  LOW: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  MEDIUM: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  HIGH: "border-red-500/30 bg-red-500/10 text-red-300",
  CRITICAL: "border-red-500/50 bg-red-500/20 text-red-200 animate-pulse",
};

export default function HistoryPage() {
  const router = useRouter();
  const { history, refreshHistory, setCurrentAnalysis } = useAIAnalysis();

  const [dateFilter, setDateFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      const createdDate = entry.createdAt?.slice(0, 10) || "";
      const risk = entry.riskLevel || "LOW";
      const dateMatches = !dateFilter || createdDate === dateFilter;
      const riskMatches = riskFilter === "ALL" || riskFilter === risk;
      return dateMatches && riskMatches;
    });
  }, [dateFilter, history, riskFilter]);

  const handleOpen = (entry: typeof history[0]) => {
    setCurrentAnalysis(entry);
    router.push(`/results?id=${entry.id}`);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <h1 className="text-3xl font-bold text-white">Analysis History</h1>
        <p className="mt-1 text-sm text-white/60">
          Review past AI analyses and track your health over time.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:w-[420px]">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Filter by date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Filter by risk</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "ALL")}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="ALL" className="bg-slate-900">All Levels</option>
              <option value="LOW" className="bg-slate-900">Low</option>
              <option value="MEDIUM" className="bg-slate-900">Medium</option>
              <option value="HIGH" className="bg-slate-900">High</option>
              <option value="CRITICAL" className="bg-slate-900">Critical</option>
            </select>
          </label>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center backdrop-blur-xl">
          <p className="text-white/60">No analyses match your filters.</p>
          <button
            type="button"
            onClick={() => router.push("/diagnosis")}
            className="mt-4 rounded-lg bg-cyan-600/30 border border-cyan-500/30 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/40"
          >
            Run New Analysis
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((entry) => {
            const risk = entry.riskLevel || "LOW";
            const riskClass = RISK_COLORS[risk] || RISK_COLORS.LOW;

            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => handleOpen(entry)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-white">{entry.testName || "Analysis"}</p>
                    <p className="text-xs text-white/50">
                      {new Date(entry.createdAt).toLocaleString()} | Models: {entry.selectedModels?.join(", ") || "auto"}
                    </p>
                    {entry.keyFindings?.length > 0 && (
                      <p className="text-sm text-white/70 line-clamp-1">{entry.keyFindings[0]}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {entry.healthScore != null && (
                      <span className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold text-white">
                        Score: {entry.healthScore}
                      </span>
                    )}
                    <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${riskClass}`}>
                      {risk}
                    </span>
                    {entry.status === "REVIEWED" && (
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                        Reviewed
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
