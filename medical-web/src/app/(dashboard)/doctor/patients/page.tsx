"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";

type PatientCase = {
  id: string;
  patientId: string;
  doctorId: string | null;
  disease: string;
  specialty: string | null;
  priority: string;
  status: string;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    name: string;
    email: string;
    age?: number;
    gender?: string;
  };
  analysis?: {
    id: string;
    testName: string;
    riskLevel: string;
    healthScore: number | null;
  } | null;
  appointments?: Array<{ id: string; scheduledAt: string; status: string }>;
};

const statusTone: Record<string, string> = {
  ASSIGNED: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PENDING: "border-white/15 bg-white/5 text-white/60",
};

export default function DoctorPatientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<PatientCase[]>("/case-assignments/my-cases");
      setCases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients.");
    } finally {
      setLoading(false);
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
    void loadCases();
  }, [authLoading, user, router, loadCases]);

  const stats = useMemo(() => {
    const active = cases.filter((c) => c.status === "ASSIGNED" || c.status === "IN_PROGRESS").length;
    const completed = cases.filter((c) => c.status === "COMPLETED").length;
    const urgent = cases.filter((c) => c.priority === "HIGH" || c.priority === "URGENT").length;
    return { active, completed, urgent };
  }, [cases]);

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
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Doctor Dashboard</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Patient Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              View assigned patients, review the latest assessment, and jump into messaging or teleconsultation.
            </p>
          </div>
          <button
            onClick={loadCases}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Active Cases</p>
            <p className="mt-2 text-3xl font-bold text-cyan-300">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">Completed</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{stats.completed}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300/70">Urgent</p>
            <p className="mt-2 text-3xl font-bold text-orange-300">{stats.urgent}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-xl">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="ml-3 text-white/60">Loading patients...</span>
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60 backdrop-blur-xl">
          No assigned patients yet.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {cases.map((patientCase) => (
            <article
              key={patientCase.id}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition hover:border-white/20"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-xl font-bold text-cyan-300">
                    {patientCase.patient.name[0]?.toUpperCase() || "P"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">{patientCase.patient.name}</h2>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${statusTone[patientCase.status] || statusTone.PENDING}`}>
                        {patientCase.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/50">
                      {patientCase.patient.age ? `${patientCase.patient.age} years` : "Age unknown"}
                      {patientCase.patient.gender ? ` · ${patientCase.patient.gender}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-white/50">{patientCase.patient.email}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">Priority</p>
                  <p className="mt-1 text-sm font-semibold text-white">{patientCase.priority}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Suspected Condition</p>
                  <p className="mt-1 text-sm text-white">{patientCase.disease.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Specialty</p>
                  <p className="mt-1 text-sm text-white">{patientCase.specialty || "Unspecified"}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Assigned On</p>
                  <p className="mt-1 text-sm text-white">{new Date(patientCase.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Health Score</p>
                  <p className="mt-1 text-sm text-white">
                    {patientCase.analysis?.healthScore ?? "N/A"}
                  </p>
                </div>
              </div>

              {patientCase.notes && (
                <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Clinical Notes</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{patientCase.notes}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push(`/results?id=${patientCase.analysis?.id}`)}
                  disabled={!patientCase.analysis?.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  View AI Report
                </button>
                <button
                  onClick={() => router.push(`/messages?contact=${patientCase.patientId}`)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  Message Patient
                </button>
                <button
                  onClick={() => router.push(`/appointments?patient=${patientCase.patientId}`)}
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/25"
                >
                  Schedule Visit
                </button>
              </div>

              {patientCase.appointments?.length ? (
                <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Upcoming Appointments</p>
                  <div className="mt-2 space-y-2">
                    {patientCase.appointments.slice(0, 2).map((appointment) => (
                      <div key={appointment.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-sm">
                        <span>{new Date(appointment.scheduledAt).toLocaleString()}</span>
                        <span className="text-white/50">{appointment.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}