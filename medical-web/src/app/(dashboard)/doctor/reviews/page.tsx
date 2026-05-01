"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchFeedbackStats } from "@/services/api";
import { apiClient } from "@/lib/apiClient";

type ReviewItem = {
  id: string;
  doctorId: string;
  analysisId: string;
  diagnosis?: string;
  notes?: string;
  recommendations: string[];
  prescription?: string;
  aiApproved?: boolean;
  aiCorrection?: string;
  createdAt: string;
  analysis?: {
    id: string;
    testName: string;
    riskLevel: string;
    healthScore: number | null;
    patient?: { id: string; name: string; email: string };
  };
};

type FeedbackStats = {
  total: number;
  aiApproved: number;
  aiCorrected: number;
  approvalRate: number;
};

export default function DoctorReviewsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "DOCTOR" && user.role !== "ADMIN") {
      router.push("/upload");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [reviewsRes, statsData] = await Promise.all([
          apiClient.get<ReviewItem[]>("/doctor-reviews/my-reviews"),
          fetchFeedbackStats().catch(() => null),
        ]);
        setReviews(reviewsRes.data);
        if (statsData) setStats(statsData as FeedbackStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reviews.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [authLoading, user, router]);

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
          <p className="mt-2 text-white/70">This page is available to doctors and admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6 text-white">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Doctor Dashboard</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Past Reviews</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          All reviews you have submitted, including AI feedback and clinical notes.
        </p>
      </div>

      {/* Feedback stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">AI Approval Rate</p>
            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {stats.approvalRate}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Total Reviews</p>
            <p className="mt-2 text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Corrections Made</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">{stats.aiCorrected}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-xl">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="ml-3 text-white/60">Loading reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60 backdrop-blur-xl">
          You have not submitted any reviews yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/20"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      {review.analysis?.patient?.name || "Unknown Patient"}
                    </h3>
                    {review.analysis?.testName && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60">
                        {review.analysis.testName}
                      </span>
                    )}
                  </div>

                  {review.diagnosis && (
                    <p className="text-sm text-white/80">
                      <span className="text-white/50">Diagnosis:</span> {review.diagnosis}
                    </p>
                  )}

                  {review.recommendations.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {review.recommendations.map((rec, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/60"
                        >
                          {rec}
                        </span>
                      ))}
                    </div>
                  )}

                  {review.notes && (
                    <p className="text-sm text-white/60">{review.notes}</p>
                  )}

                  {review.aiCorrection && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <p className="text-xs font-medium text-amber-400/80">AI Correction</p>
                      <p className="mt-1 text-sm text-amber-200/80">{review.aiCorrection}</p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      review.aiApproved
                        ? "border-green-500/40 bg-green-500/15 text-green-300"
                        : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {review.aiApproved ? "AI Approved" : "AI Corrected"}
                  </span>
                  <span className="text-xs text-white/40">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
