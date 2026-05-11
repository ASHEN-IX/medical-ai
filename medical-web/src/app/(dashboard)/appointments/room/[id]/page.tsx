"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import TeleconsultationRoom from "@/components/teleconsultation/TeleconsultationRoom";

export default function TeleconsultationPage() {
  const params = useParams<{ id?: string }>();
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
    <div className="min-h-screen bg-slate-900 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Teleconsultation Session</h1>
            <p className="text-sm text-white/50 mt-1">Room ID: {roomId}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            End Session & Return
          </button>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Video Room */}
          <div className="lg:col-span-2">
            <TeleconsultationRoom roomId={roomId} userId={user.id} />
          </div>

          {/* Sidebar: Session Details & Notes */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl">
              <h2 className="text-lg font-bold text-white">Session Info</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Patient</p>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Started At</p>
                    <p className="text-sm font-medium text-white">{new Date().toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl">
              <h2 className="text-lg font-bold text-white">Clinical Notes</h2>
              <textarea
                placeholder="Take notes during the session..."
                className="mt-4 w-full h-48 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-500/40 transition resize-none"
              />
              <button className="mt-4 w-full rounded-xl bg-cyan-500/20 border border-cyan-500/30 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/30">
                Save & Export Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
