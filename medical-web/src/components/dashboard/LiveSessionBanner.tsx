"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, ArrowRight, Zap } from "lucide-react";
import { fetchMyAppointments } from "@/services/api";

export default function LiveSessionBanner() {
  const [hasLive, setHasLive] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const appts = await fetchMyAppointments();
        const now = new Date();
        const activeAppt = appts.find((a: any) => {
          const scheduled = new Date(a.scheduledAt);
          const diffMinutes = (scheduled.getTime() - now.getTime()) / (1000 * 60);
          return (a.status === "SCHEDULED" || a.status === "IN_PROGRESS" || a.status === "CONFIRMED") && 
                 diffMinutes < 30 && diffMinutes > -120 &&
                 a.type === "TELECONSULTATION" && a.teleconsultation?.roomId;
        });
        
        if (activeAppt) {
          setHasLive(true);
          setRoomId(activeAppt.teleconsultation.roomId);
        } else {
          setHasLive(false);
        }
      } catch (e) {
        console.error(e);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!hasLive) return null;

  return (
    <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-[1px] shadow-[0_0_30px_rgba(16,185,129,0.3)]">
        <div className="relative flex flex-col items-center justify-between gap-6 rounded-[23px] bg-slate-950/90 px-8 py-6 backdrop-blur-xl md:flex-row">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Video className="h-8 w-8" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30">
                  <Zap className="h-3 w-3 fill-current" />
                  Live Now
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tele-Consultation Active</span>
              </div>
              <h2 className="mt-1 text-2xl font-black text-white tracking-tight">Your Clinical Session is Ready</h2>
              <p className="text-slate-400 text-sm font-medium">Connect with your specialist for real-time AI-assisted diagnosis and review.</p>
            </div>
          </div>
          
          <Link 
            href={roomId ? `/appointments/room/${roomId}` : "/appointments"}
            className="group flex items-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 font-black text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-95"
          >
            Enter Consultation Room
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
