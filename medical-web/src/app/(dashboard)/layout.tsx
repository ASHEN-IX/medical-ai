"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadCount, fetchAlertUnreadCount } from "@/services/api";

import Sidebar from "@/components/dashboard/Sidebar";
import TopNavbar from "@/components/dashboard/TopNavbar";
import LiveSessionBanner from "@/components/dashboard/LiveSessionBanner";

const patientNav = [
  { href: "/diagnosis", label: "Diagnosis" },
  { href: "/manual-tests", label: "Manual Tests" },
  { href: "/results", label: "Results" },
  { href: "/chat", label: "AI Assistant" },
  { href: "/appointments", label: "Appointments" },
  { href: "/medications", label: "Medications" },
  { href: "/alerts", label: "Alerts" },
  { href: "/prevention-plan", label: "Prevention" },
  { href: "/transportation", label: "Transport" },
  { href: "/consultation-history", label: "Consultation Panel" },
  { href: "/history", label: "History" },
];

const doctorNav = [
  { href: "/doctor", label: "Queue" },
  { href: "/doctor/reviews", label: "Reviews" },
  { href: "/appointments", label: "Appointments" },
  { href: "/diagnosis", label: "Diagnosis" },
  { href: "/medications", label: "Prescriptions" },
  { href: "/consultation-history", label: "Consultation Panel" },
  { href: "/history", label: "History" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout, isDoctor } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount().then(setUnreadCount);
      const interval = setInterval(() => fetchUnreadCount().then(setUnreadCount), 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
          <span className="text-slate-400 font-medium tracking-wider">Syncing with MedAI...</span>
        </div>
      </div>
    );
  }

  const navItems = isDoctor ? doctorNav : patientNav;

  return (
    <AIAnalysisProvider>
      <div className="min-h-screen bg-[#050a14] selection:bg-cyan-500/30 selection:text-white">
        {/* Ambient Background Glows */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[120px]" />
        </div>

        <TopNavbar unreadCount={unreadCount} />
        <Sidebar navItems={navItems} isDoctor={isDoctor} />

        <div className="pl-64 pt-16 relative z-10">
          <main className="p-8 mx-auto max-w-full">
            <LiveSessionBanner />
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AIAnalysisProvider>
  );
}
