"use client";

import { useState, useEffect } from "react";
import { fetchConsultationTimeline } from "@/services/api";

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  AI_ANALYSIS: { icon: "🤖", color: "border-cyan-500/30 bg-cyan-500/10", label: "AI Analysis" },
  MANUAL_TEST: { icon: "🧪", color: "border-blue-500/30 bg-blue-500/10", label: "Manual Test" },
  APPOINTMENT: { icon: "📅", color: "border-purple-500/30 bg-purple-500/10", label: "Appointment" },
  PRESCRIPTION: { icon: "💊", color: "border-emerald-500/30 bg-emerald-500/10", label: "Prescription" },
  ALERT: { icon: "🔔", color: "border-amber-500/30 bg-amber-500/10", label: "Alert" },
  TRANSPORT: { icon: "🚗", color: "border-indigo-500/30 bg-indigo-500/10", label: "Transportation" },
};

export default function ConsultationHistoryPage() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchConsultationTimeline().then(setTimeline).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const types = ["all", ...new Set(timeline.map((e) => e.type))];
  const filtered = filter === "all" ? timeline : timeline.filter((e) => e.type === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Consultation History</h1>
        <p className="mt-1 text-slate-400">Unified timeline of all your healthcare activities.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === t
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t === "all" ? "All" : TYPE_CONFIG[t]?.label || t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p>No history events found.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-4">
            {filtered.map((event, idx) => {
              const config = TYPE_CONFIG[event.type] || { icon: "📋", color: "border-white/10 bg-white/5", label: event.type };
              return (
                <div key={idx} className="relative flex gap-4 pl-2">
                  {/* Timeline dot */}
                  <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${config.color}`}>
                    {config.icon}
                  </div>
                  {/* Content */}
                  <div className={`flex-1 rounded-xl border p-4 ${config.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">{config.label}</span>
                      <span className="text-xs text-slate-500">{new Date(event.date).toLocaleString()}</span>
                    </div>
                    <div className="mt-2">
                      {event.type === "AI_ANALYSIS" && (
                        <div>
                          <p className="font-medium capitalize text-white">{event.data.testName}</p>
                          <p className="text-sm text-slate-300">Risk: {event.data.riskLevel} · Score: {event.data.healthScore ?? "N/A"}</p>
                        </div>
                      )}
                      {event.type === "APPOINTMENT" && (
                        <div>
                          <p className="font-medium text-white">
                            {event.data.doctor?.name || event.data.patient?.name}
                          </p>
                          <p className="text-sm text-slate-300">{event.data.type?.replace("_", " ")} · {event.data.status}</p>
                        </div>
                      )}
                      {event.type === "PRESCRIPTION" && (
                        <div>
                          <p className="font-medium text-white">{event.data.diagnosis || "Prescription"}</p>
                          <p className="text-sm text-slate-300">
                            {event.data.medications?.map((m: any) => m.name).join(", ")}
                          </p>
                        </div>
                      )}
                      {event.type === "MANUAL_TEST" && (
                        <div>
                          <p className="font-medium capitalize text-white">{event.data.disease} Test</p>
                          <p className="text-sm text-slate-300">Risk: {event.data.riskLevel || "N/A"}</p>
                        </div>
                      )}
                      {event.type === "ALERT" && (
                        <div>
                          <p className="font-medium text-white">{event.data.title}</p>
                          <p className="text-sm text-slate-300">{event.data.message}</p>
                        </div>
                      )}
                      {event.type === "TRANSPORT" && (
                        <div>
                          <p className="font-medium text-white">{event.data.pickupAddress} → {event.data.destAddress}</p>
                          <p className="text-sm text-slate-300">{event.data.vehicleType} · {event.data.status}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
