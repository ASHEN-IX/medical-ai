import { Suspense } from "react";

import ResultsPage from "@/pages/ResultsPage";

export default function ResultsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400 shadow-lg backdrop-blur">
          Loading analysis result...
        </div>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}
