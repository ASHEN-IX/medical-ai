"use client";

import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRiskColor(risk: string): string {
  switch (risk.toUpperCase()) {
    case "LOW":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    case "MEDIUM":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "HIGH":
      return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "CRITICAL":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-400/30";
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getChangeIndicator(change: number): { color: string; arrow: string } {
  if (change > 0) return { color: "text-red-400", arrow: "\u2191" };
  if (change < 0) return { color: "text-emerald-400", arrow: "\u2193" };
  return { color: "text-slate-500", arrow: "\u2014" };
}

export default function TimelinePage() {
  const { user } = useAuth();
  const { healthTimeline, refreshTimeline } = useAIAnalysis();

  useEffect(() => {
    refreshTimeline();
  }, [refreshTimeline]);

  const hasData =
    healthTimeline &&
    (healthTimeline.analyses.length > 0 ||
      healthTimeline.insights.length > 0 ||
      Object.keys(healthTimeline.metrics).length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Health Timeline</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user?.name ? `${user.name}'s` : "Your"} health evolution over time
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshTimeline()}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {healthTimeline!.insights.length > 0 && (
            <InsightsSection insights={healthTimeline!.insights} />
          )}
          {healthTimeline!.analyses.length > 0 && (
            <ScoreHistory analyses={healthTimeline!.analyses} />
          )}
          {Object.keys(healthTimeline!.metrics).length > 0 && (
            <MetricTrends metrics={healthTimeline!.metrics} />
          )}
          {healthTimeline!.analyses.length > 0 && (
            <PastAnalyses analyses={healthTimeline!.analyses} />
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 py-20 backdrop-blur-xl">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <svg
          className="h-8 w-8 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">No timeline data yet</h3>
      <p className="mt-2 max-w-sm text-center text-sm text-slate-400">
        Upload and analyze your medical reports to start tracking your health metrics over time.
      </p>
    </div>
  );
}

function InsightsSection({ insights }: { insights: string[] }) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Personalized Insights</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                />
              </svg>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{insight}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoreHistory({
  analyses,
}: {
  analyses: Array<{
    id: string;
    healthScore: number | null;
    riskLevel: string;
    createdAt: string;
    testName: string;
  }>;
}) {
  const sorted = [...analyses].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Health Score History</h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="relative">
          {sorted.map((analysis, idx) => (
            <div key={analysis.id} className="relative flex gap-4 pb-8 last:pb-0">
              {idx < sorted.length - 1 && (
                <div className="absolute left-[17px] top-10 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-cyan-400/40 to-white/10" />
              )}
              <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              </div>
              <div className="flex flex-1 items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {formatMetricLabel(analysis.testName)}
                    </span>
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getRiskColor(analysis.riskLevel)}`}
                    >
                      {analysis.riskLevel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(analysis.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xl font-bold tabular-nums ${getScoreColor(analysis.healthScore)}`}
                  >
                    {analysis.healthScore !== null ? analysis.healthScore : "--"}
                  </span>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Score</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricTrends({
  metrics,
}: {
  metrics: Record<string, Array<{ value: number; date: string }>>;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Metric Trends</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(metrics).map(([key, values]) => (
          <MetricCard key={key} label={key} values={values} />
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  values,
}: {
  label: string;
  values: Array<{ value: number; date: string }>;
}) {
  const sorted = [...values].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const changePercent = previous
    ? ((latest.value - previous.value) / previous.value) * 100
    : 0;

  const { color, arrow } = getChangeIndicator(changePercent);

  const maxValue = Math.max(...sorted.map((v) => v.value));
  const minValue = Math.min(...sorted.map((v) => v.value));
  const range = maxValue - minValue || 1;

  const displayValues = sorted.slice(-8);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {formatMetricLabel(label)}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {latest.value.toFixed(1)}
          </p>
        </div>
        {previous && (
          <div className={`flex items-center gap-0.5 text-sm font-semibold ${color}`}>
            <span>{arrow}</span>
            <span>{Math.abs(changePercent).toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end gap-1" style={{ height: "48px" }}>
        {displayValues.map((point, idx) => {
          const height = ((point.value - minValue) / range) * 100;
          const isLast = idx === displayValues.length - 1;
          const isImproving = changePercent <= 0;
          return (
            <div
              key={idx}
              className="relative flex-1 group"
              title={`${point.value.toFixed(1)} - ${formatDate(point.date)}`}
            >
              <div
                className={`w-full rounded-sm transition-all ${
                  isLast
                    ? isImproving
                      ? "bg-emerald-400"
                      : "bg-red-400"
                    : "bg-slate-600 group-hover:bg-slate-500"
                }`}
                style={{ height: `${Math.max(height, 8)}%` }}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-slate-600">
        {formatDate(displayValues[0].date)} — {formatDate(displayValues[displayValues.length - 1].date)}
      </p>
    </div>
  );
}

function PastAnalyses({
  analyses,
}: {
  analyses: Array<{
    id: string;
    healthScore: number | null;
    riskLevel: string;
    createdAt: string;
    testName: string;
  }>;
}) {
  const sorted = [...analyses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Past Analyses</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((analysis) => (
          <a
            key={analysis.id}
            href={`/results?id=${analysis.id}`}
            className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getRiskColor(analysis.riskLevel)}`}
              >
                {analysis.riskLevel}
              </span>
              <span
                className={`text-lg font-bold tabular-nums ${getScoreColor(analysis.healthScore)}`}
              >
                {analysis.healthScore !== null ? analysis.healthScore : "--"}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-medium text-white group-hover:text-cyan-300 transition">
              {formatMetricLabel(analysis.testName)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{formatDate(analysis.createdAt)}</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-400 transition">
              <span>View details</span>
              <svg
                className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
