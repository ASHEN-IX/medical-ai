"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadCount } from "@/services/api";

const patientNav = [
  { href: "/upload", label: "Upload" },
  { href: "/diagnosis", label: "Diagnosis" },
  { href: "/results", label: "Results" },
  { href: "/history", label: "History" },
  { href: "/timeline", label: "Timeline" },
  { href: "/chat", label: "AI Chat" },
];

const doctorNav = [
  { href: "/doctor", label: "Queue" },
  { href: "/doctor/reviews", label: "Reviews" },
  { href: "/upload", label: "Upload" },
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  const navItems = isDoctor ? doctorNav : patientNav;

  return (
    <AIAnalysisProvider>
      <div className="min-h-screen bg-slate-950">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-semibold tracking-wide text-white">
              MedAI <span className="text-cyan-400">Nexus</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link
                href="/messages"
                className={`relative rounded-lg px-3 py-1.5 transition ${
                  pathname === "/messages"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <span className="mx-2 h-6 w-px bg-white/10" />

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm text-slate-200">{user?.name || user?.email}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{user?.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AIAnalysisProvider>
  );
}
