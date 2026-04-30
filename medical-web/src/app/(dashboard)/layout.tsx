"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AIAnalysisProvider>
      <div className="min-h-screen bg-slate-950">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-semibold tracking-wide text-white">
              MedAI <span className="text-cyan-400">Nexus</span>
            </Link>
            <nav className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <Link href="/upload" className="rounded-lg px-3 py-1.5 hover:bg-white/10 hover:text-white">
                Upload
              </Link>
              <Link href="/results" className="rounded-lg px-3 py-1.5 hover:bg-white/10 hover:text-white">
                Results
              </Link>
              <Link href="/history" className="rounded-lg px-3 py-1.5 hover:bg-white/10 hover:text-white">
                History
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AIAnalysisProvider>
  );
}
