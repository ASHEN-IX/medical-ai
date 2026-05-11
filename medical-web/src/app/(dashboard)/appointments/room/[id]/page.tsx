"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import TeleconsultationRoom from "@/components/teleconsultation/TeleconsultationRoom";

export default function TeleconsultationPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roomId = typeof params?.id === "string" ? params.id : null;

  if (!user || !roomId || !user.id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 animate-in">
      <div className="glass-card p-8 border-cyan-500/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-500/80">Clinical Tele-Presence</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Live Consultation</h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Encrypted Session Room: <span className="text-cyan-400 font-mono">{roomId}</span></p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/20 active:scale-95"
          >
            Terminate Session
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Main Video Room */}
        <div className="lg:col-span-3 space-y-6">
          <TeleconsultationRoom roomId={roomId} userId={user.id} userRole={user.role} />
          
          {/* AI Real-time Intelligence Bar */}
          <div className="glass-card p-6 border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">AI Clinical Intelligence Active</h3>
              </div>
              <span className="text-[10px] font-mono text-violet-500/60">Lat: 42ms | Tokens: 1.2k/s</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Transcription</p>
                <p className="mt-1 text-sm text-white/80 line-clamp-2">"Patient reports increased fatigue and occasional palpitations..."</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Live Sentiment</p>
                <div className="mt-2 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[75%] bg-emerald-500/50" />
                </div>
                <p className="mt-1 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Calm / Informative</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-[10px] font-bold text-cyan-400 uppercase">AI Suggestion</p>
                <p className="mt-1 text-sm text-cyan-200/80 font-medium">Screen for hyperthyroidism based on reported symptoms.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Session Details & Notes */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Intelligence Panel</h2>
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Patient Vitals</span>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Synced</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">BPM</p>
                    <p className="text-lg font-black text-white">72</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">SpO2</p>
                    <p className="text-lg font-black text-white">98%</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Diagnostic Flags</span>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <p className="text-[10px] font-black text-orange-400 uppercase">Anomaly Detected</p>
                    <p className="text-xs text-orange-200/70 mt-1 font-medium">Recent blood glucose spike: 182 mg/dL (2h ago)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <p className="text-[10px] font-black text-cyan-400 uppercase">Medication Adherence</p>
                    <p className="text-xs text-cyan-200/70 mt-1 font-medium">Metformin dose confirmed via daily log.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Clinical Notes</h2>
            <textarea
              placeholder="Real-time AI assisted notes..."
              className="mt-4 w-full h-48 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition resize-none"
            />
            <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest">
              Save Clinical Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
