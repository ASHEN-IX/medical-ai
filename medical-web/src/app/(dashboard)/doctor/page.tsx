"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchDoctorQueue,
  claimDoctorRequest,
  createDoctorReview,
  fetchFeedbackStats,
  type DoctorRequest,
  type DoctorReview,
  createAppointment,
  createTeleconsultation,
} from "@/services/api";
import { Video } from "lucide-react";

const URGENCY_ORDER: Record<string, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  NORMAL: 2,
  LOW: 3,
};

const urgencyBadge = (urgency: string) => {
  switch (urgency) {
    case "EMERGENCY":
      return "border-red-500/40 bg-red-500/20 text-red-300 animate-pulse";
    case "URGENT":
      return "border-orange-500/40 bg-orange-500/20 text-orange-300";
    case "NORMAL":
      return "border-blue-500/40 bg-blue-500/20 text-blue-300";
    default:
      return "border-white/20 bg-white/10 text-white/60";
  }
};

const riskBadge = (risk: string) => {
  switch (risk) {
    case "CRITICAL":
      return "border-red-500/40 bg-red-500/20 text-red-300";
    case "HIGH":
      return "border-orange-500/40 bg-orange-500/20 text-orange-300";
    case "MEDIUM":
      return "border-yellow-500/40 bg-yellow-500/20 text-yellow-300";
    default:
      return "border-green-500/40 bg-green-500/20 text-green-300";
  }
};

type FeedbackStats = {
  total: number;
  aiApproved: number;
  aiCorrected: number;
  approvalRate: number;
};

type ReviewFormState = {
  diagnosis: string;
  notes: string;
  recommendations: string;
  prescription: string;
  aiApproved: boolean;
  aiCorrection: string;
};

const emptyReviewForm: ReviewFormState = {
  diagnosis: "",
  notes: "",
  recommendations: "",
  prescription: "",
  aiApproved: true,
  aiCorrection: "",
};

export default function DoctorQueuePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [queue, setQueue] = useState<DoctorRequest[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewForms, setReviewForms] = useState<Record<string, ReviewFormState>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const [queueData, statsData] = await Promise.all([
        fetchDoctorQueue(),
        fetchFeedbackStats().catch(() => null),
      ]);
      setQueue(queueData);
      if (statsData) setStats(statsData as FeedbackStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue.");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "DOCTOR" && user.role !== "ADMIN") {
      router.push("/diagnosis");
      return;
    }
    void loadData();
  }, [authLoading, user, router, loadData]);

  const sortedQueue = useMemo(
    () =>
      [...queue].sort((a, b) => {
        const urgDiff = (URGENCY_ORDER[a.urgency] ?? 4) - (URGENCY_ORDER[b.urgency] ?? 4);
        if (urgDiff !== 0) return urgDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [queue]
  );

  const pendingCount = useMemo(
    () => queue.filter((r) => r.status === "PENDING" || r.status === "ASSIGNED").length,
    [queue]
  );
  const urgentCount = useMemo(
    () => queue.filter((r) => r.urgency === "URGENT" || r.urgency === "EMERGENCY").length,
    [queue]
  );

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    try {
      await claimDoctorRequest(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim request.");
    } finally {
      setClaimingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (!reviewForms[id]) {
      setReviewForms((prev) => ({ ...prev, [id]: { ...emptyReviewForm } }));
    }
  };

  const updateForm = (id: string, field: keyof ReviewFormState, value: string | boolean) => {
    setReviewForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSubmitReview = async (request: DoctorRequest) => {
    const form = reviewForms[request.id];
    if (!form || !request.analysisId) return;

    setSubmittingId(request.id);
    setError(null);
    try {
      await createDoctorReview({
        analysisId: request.analysisId,
        diagnosis: form.diagnosis || undefined,
        notes: form.notes || undefined,
        recommendations: form.recommendations
          ? form.recommendations.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        prescription: form.prescription || undefined,
        aiApproved: form.aiApproved,
        aiCorrection: !form.aiApproved ? form.aiCorrection || undefined : undefined,
      });
      setExpandedId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmittingId(null);
    }
  };

  const handleQuickSchedule = async (request: DoctorRequest) => {
    if (!request.patientId || !user?.id) return;
    setClaimingId(request.id);
    try {
      const now = new Date();
      const scheduledAt = now.toISOString();
      
      const appt = await createAppointment({
        doctorId: user.id,
        patientId: request.patientId,
        scheduledAt,
        durationMinutes: 30,
        type: "TELECONSULTATION",
        notes: `Quick session for ${request.analysis?.testName || 'analysis'}`,
      });
      
      if (appt.id) {
        const tc = await createTeleconsultation(appt.id);
        if (tc?.roomId) {
          router.push(`/appointments/room/${tc.roomId}`);
        } else {
          router.push("/appointments");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quick session.");
    } finally {
      setClaimingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          Loading...
        </div>
      </div>
    );
  }

  if (user.role !== "DOCTOR" && user.role !== "ADMIN") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-white/70">This dashboard is available to doctors and admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8 text-white animate-in">
      {/* Header */}
      <div className="glass-card p-8 border-cyan-500/10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-500/80">Clinical Operations</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white">Patient Queue</h1>
            <p className="mt-2 text-slate-400 max-w-lg">Manage incoming diagnostic requests and provide expert clinical reviews to refine AI assessments.</p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card bg-white/5 border-white/5 px-6 py-4 flex flex-col items-center">
              <span className="text-2xl font-bold text-white">{pendingCount}</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Pending</span>
            </div>
            <div className="glass-card bg-orange-500/10 border-orange-500/20 px-6 py-4 flex flex-col items-center">
              <span className="text-2xl font-bold text-orange-400">{urgentCount}</span>
              <span className="text-[10px] uppercase tracking-widest text-orange-500/60 font-bold">Urgent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback stats */}
      {stats && (
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="glass-card p-6 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">AI Approval Rate</p>
            <p className="mt-2 text-4xl font-black text-white">
              {stats.approvalRate}<span className="text-lg text-cyan-500">%</span>
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Total Reviews</p>
            <p className="mt-2 text-4xl font-black text-white">{stats.total}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80 font-bold">Corrections Made</p>
            <p className="mt-2 text-4xl font-black text-white">{stats.aiCorrected}</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Queue */}
      {loadingQueue ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-xl">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="ml-3 text-white/60">Loading queue...</span>
        </div>
      ) : sortedQueue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60 backdrop-blur-xl">
          No pending patient requests in the queue.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedQueue.map((req) => {
            const isExpanded = expandedId === req.id;
            const form = reviewForms[req.id] ?? emptyReviewForm;
            const analysis = req.analysis;
            const patient = req.patient;

            return (
              <article
                key={req.id}
                className="glass-card hover:bg-white/10 transition-all duration-300"
              >
                {/* Card header */}
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold">
                        {patient?.name || "Unknown Patient"}
                      </h3>
                      {patient?.age && (
                        <span className="text-sm text-white/50">
                          {patient.age}y{patient.gender ? ` / ${patient.gender}` : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-medium uppercase tracking-wide ${urgencyBadge(req.urgency)}`}
                      >
                        {req.urgency}
                      </span>
                      {analysis?.riskLevel && (
                        <span
                          className={`rounded-full border px-3 py-0.5 text-xs font-medium uppercase tracking-wide ${riskBadge(analysis.riskLevel)}`}
                        >
                          {analysis.riskLevel} risk
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60">
                        {req.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/60">
                      {analysis?.testName && (
                        <span>
                          Test: <span className="text-white/80">{analysis.testName}</span>
                        </span>
                      )}
                      <span>
                        Uploaded:{" "}
                        <span className="text-white/80">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>

                    {analysis?.keyFindings && analysis.keyFindings.length > 0 && (
                      <div className="mt-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-400/80">
                          AI Flags
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm text-amber-200/80">
                          {analysis.keyFindings.slice(0, 3).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-3">
                    {!req.doctorId && req.status === "PENDING" && (
                      <button
                        type="button"
                        disabled={claimingId === req.id}
                        onClick={() => handleClaim(req.id)}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-200 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/20 disabled:opacity-50"
                      >
                        {claimingId === req.id ? "Claiming..." : "Claim"}
                      </button>
                    )}
                    {req.status === "ASSIGNED" && req.doctorId === user?.id && (
                      <button
                        type="button"
                        onClick={() => handleQuickSchedule(req)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95"
                      >
                        <Video className="h-4 w-4" />
                        Start Live Session
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpand(req.id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition-all hover:border-white/20 hover:bg-white/10"
                    >
                      {isExpanded ? "Close" : "Review"}
                    </button>
                  </div>
                </div>

                {/* Expanded review section */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-5">
                    {/* Analysis data */}
                    {analysis && (
                      <div className="mb-6 space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/50">
                          Analysis Data
                        </h4>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">
                              Features
                            </p>
                            <pre className="overflow-auto text-xs text-white/80">
                              {JSON.stringify(analysis.features, null, 2)}
                            </pre>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">
                              Symptoms
                            </p>
                            <p className="text-sm text-white/80">
                              {analysis.symptoms?.length
                                ? analysis.symptoms.join(", ")
                                : "None reported"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">
                            Model Results
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(analysis.results || {}).map(([model, result]) => (
                              <div
                                key={model}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <p className="text-xs font-medium text-white/60">{model}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadge(result.risk)}`}
                                  >
                                    {result.risk}
                                  </span>
                                  <span className="text-sm text-white/70">
                                    {(result.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {analysis.healthScore !== null && analysis.healthScore !== undefined && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-white/45">
                              Health Score
                            </p>
                            <p className="text-2xl font-bold text-cyan-400">{analysis.healthScore}</p>
                          </div>
                        )}

                        {analysis.aiInsights && (
                          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-cyan-400/80">
                              AI Reasoning / Insights
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-white/80">
                              {analysis.aiInsights}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review form */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-white/50">
                        Doctor Review
                      </h4>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">
                            Diagnosis
                          </label>
                          <input
                            type="text"
                            value={form.diagnosis}
                            onChange={(e) => updateForm(req.id, "diagnosis", e.target.value)}
                            placeholder="Primary diagnosis"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">
                            Prescription
                          </label>
                          <input
                            type="text"
                            value={form.prescription}
                            onChange={(e) => updateForm(req.id, "prescription", e.target.value)}
                            placeholder="Prescribed treatment"
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">
                          Clinical Notes
                        </label>
                        <textarea
                          rows={3}
                          value={form.notes}
                          onChange={(e) => updateForm(req.id, "notes", e.target.value)}
                          placeholder="Additional clinical notes..."
                          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">
                          Recommendations (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={form.recommendations}
                          onChange={(e) => updateForm(req.id, "recommendations", e.target.value)}
                          placeholder="Follow-up in 2 weeks, Blood panel, Lifestyle changes"
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                        />
                      </div>

                      {/* AI feedback toggle */}
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
                          AI Feedback
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => updateForm(req.id, "aiApproved", true)}
                            className={`rounded-xl border px-5 py-2 text-sm font-semibold transition-all ${
                              form.aiApproved
                                ? "border-green-500/40 bg-green-500/20 text-green-300"
                                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                            }`}
                          >
                            Approve AI
                          </button>
                          <button
                            type="button"
                            onClick={() => updateForm(req.id, "aiApproved", false)}
                            className={`rounded-xl border px-5 py-2 text-sm font-semibold transition-all ${
                              !form.aiApproved
                                ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                            }`}
                          >
                            Correct AI
                          </button>
                        </div>

                        {!form.aiApproved && (
                          <textarea
                            rows={2}
                            value={form.aiCorrection}
                            onChange={(e) => updateForm(req.id, "aiCorrection", e.target.value)}
                            placeholder="Describe what the AI got wrong and the correct assessment..."
                            className="mt-3 w-full resize-none rounded-xl border border-amber-500/20 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                          />
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleSubmitReview(req)}
                          className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition-all hover:from-cyan-500/90 hover:to-blue-500/90 disabled:opacity-50"
                        >
                          {submittingId === req.id ? "Submitting..." : "Submit Review"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
