import { Suspense } from "react";

import ResultsPage from "@/pages/ResultsPage";

export default function ResultsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 text-center text-slate-600 shadow-lg">
          Loading analysis result...
        </div>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}
