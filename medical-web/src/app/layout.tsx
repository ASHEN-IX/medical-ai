import type { Metadata } from "next";
import Link from "next/link";
import { Lora, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { AIAnalysisProvider } from "@/hooks/useAIAnalysis";

import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const bodyFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "MedAI Nexus Dashboard",
  description: "Medical AI dashboard for report intake, risk analysis, and clinical intelligence review.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        <AIAnalysisProvider>
          <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                <Link href="/" className="text-lg font-semibold tracking-wide text-slate-900">
                  MedAI Nexus
                </Link>
                <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Link href="/upload" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                    Upload
                  </Link>
                  <Link href="/results" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                    Results
                  </Link>
                  <Link href="/history" className="rounded-lg px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
                    History
                  </Link>
                </nav>
              </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
          </div>
        </AIAnalysisProvider>
      </body>
    </html>
  );
}
