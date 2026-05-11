"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMyAppointments, cancelAppointment, createTeleconsultation } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "text-blue-400 bg-blue-500/10",
  CONFIRMED: "text-emerald-400 bg-emerald-500/10",
  IN_PROGRESS: "text-amber-400 bg-amber-500/10",
  COMPLETED: "text-slate-400 bg-slate-500/10",
  CANCELLED: "text-red-400 bg-red-500/10",
  NO_SHOW: "text-rose-400 bg-rose-500/10",
};

export default function AppointmentsPage() {
  const { isDoctor } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyAppointments().then(setAppointments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id: string) => {
    await cancelAppointment(id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "CANCELLED" } : a));
  };

  const handleStartTele = async (id: string) => {
    try {
      const tc = await createTeleconsultation(id);
      if (tc?.roomId) {
        router.push(`/appointments/room/${tc.roomId}`);
        return;
      }
      alert("Teleconsultation room was created but no room ID was returned.");
    } catch {
      alert("Failed to create teleconsultation room.");
    }
  };

  const upcoming = appointments.filter((a) => new Date(a.scheduledAt) >= new Date() && a.status !== "CANCELLED");
  const past = appointments.filter((a) => new Date(a.scheduledAt) < new Date() || a.status === "CANCELLED" || a.status === "COMPLETED");

  return (
    <div className="space-y-8 animate-in">
      <div className="glass-card p-8 border-cyan-500/10">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-500/80">Care Coordination</p>
        <h1 className="text-4xl font-black text-white mt-2">Appointments</h1>
        <p className="mt-2 text-slate-400 font-medium">Manage your clinical consultations and video sessions with specialists.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 ml-2">Upcoming Schedule</h2>
            {upcoming.length === 0 ? (
              <div className="glass-card p-12 text-center text-slate-500 border-dashed">No upcoming appointments found.</div>
            ) : (
              <div className="grid gap-4">
                {upcoming.map((appt) => (
                  <div key={appt.id} className="glass-card p-6 hover:bg-white/10 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <span className="text-cyan-400 font-bold text-xl">{isDoctor ? appt.patient?.name?.[0] : appt.doctor?.name?.[0]}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-white">
                            {isDoctor ? appt.patient?.name : appt.doctor?.name}
                          </p>
                          <p className="text-sm text-slate-400 font-medium">
                            {new Date(appt.scheduledAt).toLocaleDateString()} at {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md text-slate-400 border border-white/5">{appt.type.replace("_", " ")}</span>
                            <span className="text-[10px] uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md text-slate-400 border border-white/5">{appt.durationMinutes} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-white/5 ${STATUS_COLORS[appt.status] || ""}`}>
                          {appt.status}
                        </span>
                        {appt.type === "TELECONSULTATION" && (
                          <button
                            onClick={() => handleStartTele(appt.id)}
                            className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 transition-all active:scale-95"
                          >
                            Start Session
                          </button>
                        )}
                        {appt.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancel(appt.id)}
                            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            title="Cancel Appointment"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-200">Past ({past.length})</h2>
            <div className="space-y-2">
              {past.map((appt) => (
                <div key={appt.id} className="rounded-xl border border-white/10 bg-white/5 p-3 opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-300">
                        {isDoctor ? appt.patient?.name : appt.doctor?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(appt.scheduledAt).toLocaleString()} · {appt.type.replace("_", " ")}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[appt.status] || ""}`}>
                      {appt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
