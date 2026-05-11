"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";

type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions: string | null;
  sideEffects: string[];
  isActive: boolean;
};

type Prescription = {
  id: string;
  doctor: { name: string };
  diagnosis: string | null;
  isActive: boolean;
  createdAt: string;
  medications: Medication[];
};

type Reminder = {
  id: string;
  medication: Medication;
  scheduledAt: string;
  taken: boolean;
  skipped?: boolean;
};

type AdherenceSummary = {
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
};

export default function MedicationsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rxRes, remRes] = await Promise.all([
        apiClient.get("/prescriptions/my"),
        apiClient.get("/prescriptions/reminders/upcoming"),
      ]);
      setPrescriptions(rxRes.data);
      setReminders(remRes.data);
      const summaryRes = await apiClient.get("/prescriptions/reminders/adherence-summary");
      setSummary(summaryRes.data);
    } catch (err) {
      console.error("Failed to load medication data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefillRequest = async (rxId: string) => {
    try {
      await apiClient.post(`/prescriptions/${rxId}/refill`);
      alert("Refill request sent to your doctor!");
    } catch (err) {
      alert("Failed to send refill request.");
    }
  };

  const handleMarkTaken = async (remId: string) => {
    try {
      await apiClient.patch(`/prescriptions/reminders/${remId}/taken`);
      setReminders((prev) => prev.filter((r) => r.id !== remId));
    } catch (err) {
      alert("Failed to update reminder.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Therapy & Adherence</h1>
        <p className="mt-2 text-sm text-white/50">Manage your active prescriptions and track daily medication adherence.</p>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Adherence Trackers */}
          <div className="lg:col-span-1 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Daily Schedule</h2>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full uppercase">Today</span>
              </div>
              
              <div className="space-y-4">
                {reminders.length === 0 ? (
                  <p className="text-center py-8 text-sm text-white/30 italic">No pending doses for today.</p>
                ) : (
                  reminders.map((rem) => (
                    <div key={rem.id} className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                          💊
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{rem.medication.name}</p>
                          <p className="text-[10px] text-white/40">{new Date(rem.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleMarkTaken(rem.id)}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 transition hover:bg-emerald-500 hover:text-white"
                      >
                        Taken
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 p-6 backdrop-blur-xl shadow-xl">
              <h3 className="text-sm font-bold text-white">Adherence Score</h3>
              <p className="mt-2 text-4xl font-black text-white">{summary?.adherenceRate ?? 0}%</p>
              <p className="mt-1 text-[10px] text-white/60">
                {summary
                  ? `${summary.taken} taken, ${summary.missed} missed, ${summary.skipped} skipped.`
                  : "Tracking your dose adherence from live reminders."}
              </p>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  style={{ width: `${summary?.adherenceRate ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Prescriptions */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-white">Clinical Prescriptions</h2>
            {prescriptions.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                <p className="text-lg font-medium text-white/40">No active prescriptions</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="group relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition hover:border-cyan-500/30 shadow-2xl overflow-hidden">
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl border border-white/10">
                          📄
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{rx.doctor.name}</h3>
                          <p className="text-xs text-white/40">Issued on {new Date(rx.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                          rx.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"
                        }`}>
                          {rx.isActive ? "Active" : "Archived"}
                        </span>
                        <button 
                          onClick={() => handleRefillRequest(rx.id)}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
                        >
                          Request Refill
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {rx.medications.map((med) => (
                        <div key={med.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-white">{med.name}</p>
                            <p className="text-xs font-medium text-cyan-400">{med.dosage}</p>
                          </div>
                          <p className="text-xs text-white/60 mb-4">{med.frequency}</p>
                          {med.instructions && (
                            <div className="rounded-xl bg-white/5 p-3 text-[10px] text-white/50 leading-relaxed italic">
                              "{med.instructions}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
