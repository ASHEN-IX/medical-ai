"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.04] px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.772.13c-1.687.282-3.4.419-5.113.419H11.5c-1.713 0-3.426-.137-5.113-.419l-.772-.13c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">
              MedAI <span className="text-slate-500">Nexus</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <Link href="#" className="transition-colors hover:text-slate-400">Privacy</Link>
            <Link href="#" className="transition-colors hover:text-slate-400">Terms</Link>
            <Link href="#" className="transition-colors hover:text-slate-400">Contact</Link>
            <Link href="#" className="transition-colors hover:text-slate-400">Docs</Link>
          </div>

          <p className="text-xs text-slate-700">
            &copy; 2026 MedAI Nexus
          </p>
        </div>
      </div>
    </footer>
  );
}
