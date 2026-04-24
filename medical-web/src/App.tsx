import Link from "next/link";

export default function App() {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-xl shadow-cyan-100/30 backdrop-blur">
        <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
          Production Clinical Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          MedAI Nexus Frontend Dashboard
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          End-to-end workflow for medical intelligence: upload reports, orchestrate AI Gateway analysis, review
          clinical risk output, and track historical decisions.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-700"
          >
            Start Analysis
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Open History
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1. Upload</h2>
          <p className="mt-2 text-sm text-slate-600">Drop medical report files or provide clinical values manually.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Analyze</h2>
          <p className="mt-2 text-sm text-slate-600">FastAPI AI Gateway orchestrates model selection and risk scoring.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">3. Review</h2>
          <p className="mt-2 text-sm text-slate-600">Interpret reasoning, confidence, priority, and revisit prior analyses.</p>
        </article>
      </div>
    </section>
  );
}
