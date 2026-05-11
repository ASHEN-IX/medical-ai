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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Appointments</h1>
        <p className="mt-1 text-slate-400">Manage your consultations and teleconsultation sessions.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-200">Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((appt) => (
                  <div key={appt.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {isDoctor ? appt.patient?.name : appt.doctor?.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {new Date(appt.scheduledAt).toLocaleString()} · {appt.durationMinutes} min · {appt.type.replace("_", " ")}
                        </p>
                        {appt.notes && <p className="mt-1 text-xs text-slate-500">{appt.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] || ""}`}>
                          {appt.status}
                        </span>
                        {appt.type === "TELECONSULTATION" && (
                          <button
                            onClick={() => handleStartTele(appt.id)}
                            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
                          >
                            Start Video
                          </button>
                        )}
                        {appt.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancel(appt.id)}
                            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30"
                          >
                            Cancel
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
