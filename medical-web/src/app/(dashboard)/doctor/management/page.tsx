"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

type CaseAssignment = {
  id: string;
  patientId: string;
  doctorId: string;
  disease: string;
  priority: string;
  status: string;
  notes: string | null;
  createdAt: string;
  patient: { id: string; name: string; email: string; age?: number; gender?: string };
  analysisId?: string;
};

export default function DoctorManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "completed">("active");

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/case-assignments/my-cases");
      setCases(data);
    } catch (err) {
      console.error("Failed to load doctor cases", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filteredCases = cases.filter((c) => {
    if (activeTab === "pending") return c.status === "PENDING";
    if (activeTab === "active") return c.status === "IN_PROGRESS" || c.status === "ACCEPTED";
    return c.status === "COMPLETED";
  });

  const handleStartConsultation = async (caseId: string, patientId: string) => {
    try {
      // Create teleconsultation room
      const { data } = await apiClient.post("/appointments/teleconsultation", {
        patientId,
        scheduledAt: new Date().toISOString(),
      });
      router.push(`/appointments/room/\${data.roomId}`);
    } catch (err) {
      alert("Failed to start teleconsultation.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clinical Case Management</h1>
          <p className="mt-2 text-sm text-white/50">Manage your assigned patients, review AI diagnostics, and start teleconsultations.</p>
        </div>
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-xl">
          {(["pending", "active", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all \${
                activeTab === tab ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <p className="text-lg font-medium text-white/40">No \${activeTab} cases found</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredCases.map((c) => (
            <div key={c.id} className="group relative rounded-3xl border border-white/10 bg-white/5 p-8 transition-all hover:border-cyan-500/30 hover:bg-white/[0.07] shadow-2xl overflow-hidden">
              {/* Priority Glow */}
              {c.priority === "HIGH" && (
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-red-500/10 blur-3xl" />
              )}
              
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold text-xl">
                    {c.patient.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{c.patient.name}</h3>
                    <p className="text-xs text-white/40">{c.patient.age || "??"} Y, {c.patient.gender || "Unknown"}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest \${
                  c.priority === "HIGH" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                }`}>
                  {c.priority} Priority
                </span>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Suspected Condition</span>
                  <p className="mt-1 text-sm font-medium text-white">{c.disease.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Assigned On</span>
                  <p className="mt-1 text-sm font-medium text-white">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {c.notes && (
                <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Clinical Notes</span>
                  <p className="mt-1 text-xs leading-relaxed text-white/60 line-clamp-2">{c.notes}</p>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => router.push(`/results?id=\${c.analysisId}`)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white transition hover:bg-white/10"
                >
                  View AI Report
                </button>
                <button
                  onClick={() => handleStartConsultation(c.id, c.patientId)}
                  className="flex-1 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
                >
                  Start Teleconsultation
                </button>
                <button
                  onClick={() => router.push(`/messages?contact=\${c.patientId}`)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
