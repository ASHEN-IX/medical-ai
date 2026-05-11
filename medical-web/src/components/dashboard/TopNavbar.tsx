"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Bell, Search, User, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyAppointments } from "@/services/api";

interface TopNavbarProps {
  unreadCount: number;
}

export default function TopNavbar({ unreadCount }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const appts = await fetchMyAppointments();
        const active = appts.some((a: any) => 
          (a.status === "SCHEDULED" || a.status === "IN_PROGRESS") && 
          a.type === "TELECONSULTATION"
        );
        setIsLive(active);
      } catch {
        setIsLive(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 z-50 w-full glass-navbar">
      <div className="flex h-16 items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <Link href="/diagnosis" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20" />
            <span className="text-xl font-black tracking-tighter text-white">MedAI <span className="text-cyan-400">Nexus</span></span>
          </Link>

          <div className="hidden items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 md:flex group focus-within:border-cyan-500/50 transition-all">
            <Search className="h-4 w-4 text-slate-500 group-focus-within:text-cyan-400" />
            <input
              type="text"
              placeholder="Search medical records..."
              className="bg-transparent px-2 text-sm text-white placeholder-slate-500 outline-none w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isLive && (
            <Link 
              href="/appointments"
              className="flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/20"
            >
              <Video className="h-4 w-4 fill-emerald-500/50" />
              <span className="animate-bounce">LIVE SESSION ACTIVE</span>
            </Link>
          )}

          <div className="h-8 w-px bg-white/10" />

          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            )}
          </button>

          <div className="flex items-center gap-4 pl-2 border-l border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-white">{user?.name}</span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{user?.role}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-inner">
              {user?.name?.[0]}
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
