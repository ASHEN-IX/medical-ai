"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import {
  createDoctorRequest,
  fetchReviewsForAnalysis,
  type DoctorReview,
  type AnalysisHistoryItem,
} from "@/services/api";
import BiomarkerTrends from "@/components/analytics/BiomarkerTrends";

const RISK_STYLES: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  LOW: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/30", dot: "bg-emerald-400" },
  MEDIUM: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30", dot: "bg-amber-400" },
  HIGH: { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/30", dot: "bg-red-400" },
  CRITICAL: { bg: "bg-red-600/20", text: "text-red-300", ring: "ring-red-500/50", dot: "bg-red-400" },
};

function riskStyle(level: string) {
  return RISK_STYLES[level] ?? RISK_STYLES.LOW;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#ef4444";
  return "#dc2626";
}

function HealthGauge({ score }: { score: number }) {
  const radius = 80;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums text-white" style={{ textShadow: `0 0 20px ${color}40` }}>
          {score}
        </span>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">
          Health Score
        </span>
      </div>
    </div>
  );
}

function RiskBadge({ level, pulse }: { level: string; pulse?: boolean }) {
  const s = riskStyle(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${s.bg} ${s.text} ${s.ring} ${pulse ? "animate-pulse" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </h2>
  );
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const { currentAnalysis, openHistoryItem } = useAIAnalysis();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestSpecialty, setRequestSpecialty] = useState("");
  const [requestUrgency, setRequestUrgency] = useState("MEDIUM");
  const [requestNotes, setRequestNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const analysisId = searchParams?.get("id") ?? null;

  useEffect(() => {
    if (analysisId && (!currentAnalysis || currentAnalysis.id !== analysisId)) {
      openHistoryItem(analysisId);
    }
  }, [analysisId, currentAnalysis, openHistoryItem]);

  const analysis: AnalysisHistoryItem | null = currentAnalysis;

  useEffect(() => {
    if (!analysis?.id) return;
    fetchReviewsForAnalysis(analysis.id)
      .then(setReviews)
      .catch(() => setReviews(analysis.doctorReviews ?? []));
  }, [analysis?.id, analysis?.doctorReviews]);

  const handleRequestSubmit = useCallback(async () => {
    if (!analysis?.id) return;
    setSubmitting(true);
    setRequestError(null);
    try {
      await createDoctorRequest({
        analysisId: analysis.id,
        specialty: requestSpecialty || undefined,
        urgency: requestUrgency,
        notes: requestNotes || undefined,
      });
      setRequestSuccess(true);
      setShowRequestForm(false);
      setRequestSpecialty("");
      setRequestNotes("");
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setSubmitting(false);
    }
  }, [analysis?.id, requestSpecialty, requestUrgency, requestNotes]);

  const llm = analysis?.response?.llm_explanation ?? null;
  const response = analysis?.response ?? ({} as any);

  const modelEntries = useMemo(
    () => Object.entries(analysis?.results ?? {}),
    [analysis?.results],
  );

  if (!analysis) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-white/5 p-6">
          <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-slate-300">No analysis selected</p>
        <p className="max-w-sm text-sm text-slate-500">
          Upload a medical report or select a previous analysis from your history to view results here.
        </p>
      </div>
    );
  }

  const healthScore = analysis.healthScore ?? 0;

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Analysis Results</h1>
          <p className="mt-1 text-sm text-slate-400">
            {analysis.testName} -- {new Date(analysis.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <RiskBadge level={analysis.riskLevel} pulse={analysis.riskLevel === "CRITICAL"} />
      </div>

      {/* Top row: Score + Key Findings + AI Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health Score */}
        <Card className="flex flex-col items-center justify-center lg:col-span-1">
          <HealthGauge score={healthScore} />
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500">Risk Level</span>
            <RiskBadge level={analysis.riskLevel} pulse={analysis.riskLevel === "CRITICAL"} />
          </div>
        </Card>

        {/* Key Findings */}
        <Card className="lg:col-span-2">
          <SectionLabel>Key Findings</SectionLabel>
          {analysis.keyFindings.length > 0 ? (
            <ul className="space-y-3">
              {analysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-[10px] font-bold text-cyan-400">
                    {i + 1}
                  </span>
                  {finding}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No key findings recorded.</p>
          )}
        </Card>
      </div>

      {/* AI Insights */}
      {analysis.aiInsights && (
        <Card>
          <SectionLabel>AI Insights</SectionLabel>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {analysis.aiInsights}
          </p>
        </Card>
      )}
      {/* Biomarker Trends */}
      <BiomarkerTrends />

      {/* Model Results Grid */}
      {modelEntries.length > 0 && (
        <div>
          <SectionLabel>Model Results</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modelEntries.map(([model, result]) => (
              <Card key={model} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-slate-200">{model}</span>
                  <RiskBadge level={result.risk} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Confidence</span>
                  </div>
                  <ConfidenceBar value={result.confidence} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* LLM Explanation */}
      {llm && (
        <Card className="space-y-6">
          <SectionLabel>Detailed Explanation</SectionLabel>

          {llm.summary && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">Summary</h3>
              <p className="text-sm leading-relaxed text-slate-300">{llm.summary}</p>
            </div>
          )}

          {llm.explanation?.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">Explanation</h3>
              <ul className="space-y-2">
                {llm.explanation.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                    <span className="mt-0.5 text-slate-600">--</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {llm.risk_interpretation && (
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <RiskBadge level={llm.risk_interpretation.level} />
              <span className="text-sm text-slate-400">{llm.risk_interpretation.meaning}</span>
            </div>
          )}

          {llm.recommendations?.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">Recommendations</h3>
              <ul className="space-y-2">
                {llm.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                    <span className="mt-0.5 shrink-0 text-emerald-500">&bull;</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {llm.safety_note && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">Safety Note</h3>
              <p className="text-sm leading-relaxed text-amber-200/80">{llm.safety_note}</p>
            </div>
          )}
        </Card>
      )}

      {/* Request Doctor Review */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Doctor Review</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Request a medical professional to review this analysis
            </p>
          </div>
          {!showRequestForm && !requestSuccess && (
            <button
              type="button"
              onClick={() => setShowRequestForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-400 ring-1 ring-cyan-500/20 transition hover:bg-cyan-500/20 hover:ring-cyan-500/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Request Doctor Review
            </button>
          )}
          {requestSuccess && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Request sent successfully
            </span>
          )}
        </div>

        {showRequestForm && (
          <div className="mt-6 space-y-4 border-t border-white/5 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="specialty" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Specialty (optional)
                </label>
                <select
                  id="specialty"
                  value={requestSpecialty}
                  onChange={(e) => setRequestSpecialty(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                >
                  <option value="">Any available doctor</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="endocrinology">Endocrinology</option>
                  <option value="nephrology">Nephrology</option>
                  <option value="neurology">Neurology</option>
                  <option value="general">General Practice</option>
                  <option value="pediatrics">Pediatrics</option>
                </select>
              </div>
              <div>
                <label htmlFor="urgency" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Urgency
                </label>
                <select
                  id="urgency"
                  value={requestUrgency}
                  onChange={(e) => setRequestUrgency(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                >
                  <option value="LOW">Low -- routine review</option>
                  <option value="MEDIUM">Medium -- within 24 hours</option>
                  <option value="URGENT">Urgent -- as soon as possible</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-slate-400">
                Additional Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Any specific concerns or context for the doctor..."
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              />
            </div>
            {requestError && (
              <p className="text-sm text-red-400">{requestError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {submitting ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Doctor Reviews */}
      {reviews.length > 0 && (
        <div>
          <SectionLabel>Doctor Reviews</SectionLabel>
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {review.doctor?.name ?? "Doctor"}
                    </p>
                    {review.doctor?.doctorProfile?.specialty && (
                      <p className="text-xs text-slate-500">{review.doctor.doctorProfile.specialty}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {review.aiApproved != null && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          review.aiApproved
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {review.aiApproved ? "AI Approved" : "AI Correction"}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {review.diagnosis && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Diagnosis</h4>
                    <p className="text-sm text-slate-300">{review.diagnosis}</p>
                  </div>
                )}

                {review.notes && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</h4>
                    <p className="whitespace-pre-line text-sm text-slate-300">{review.notes}</p>
                  </div>
                )}

                {review.recommendations?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Recommendations</h4>
                    <ul className="space-y-1">
                      {review.recommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                          <span className="mt-0.5 shrink-0 text-cyan-600">&bull;</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.prescription && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-400">Prescription</h4>
                    <p className="whitespace-pre-line text-sm text-violet-200/80">{review.prescription}</p>
                  </div>
                )}

                {review.aiCorrection && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400">AI Correction</h4>
                    <p className="text-sm text-amber-200/80">{review.aiCorrection}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
