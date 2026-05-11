"use client";

import { useState, useEffect } from "react";
import { fetchManualTestSchemas, runManualTest } from "@/services/api";

const RISK_COLORS: Record<string, string> = {
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  HIGH: "text-red-400 bg-red-500/10 border-red-500/30",
  CRITICAL: "text-rose-300 bg-rose-500/20 border-rose-500/40",
};

const DISEASE_ICONS: Record<string, string> = {
  diabetes: "🩸", kidney: "🫘", heart: "❤️", stroke: "🧠",
  liver: "🫁", thyroid: "🦋", autism: "🧩",
};

type FieldSchema = {
  key: string; label: string; type: string;
  unit?: string; min?: number; max?: number; options?: string[];
};

type DiseaseSchema = {
  label: string;
  fields: FieldSchema[];
};

export default function ManualTestsPage() {
  const [schemas, setSchemas] = useState<Record<string, DiseaseSchema>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchManualTestSchemas().then(setSchemas).catch(() => {});
  }, []);

  const diseases = Object.keys(schemas);
  const activeSchema = selected ? schemas[selected] : null;

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const numericData: Record<string, any> = {};
      for (const [key, val] of Object.entries(formData)) {
        numericData[key] = isNaN(Number(val)) ? val : Number(val);
      }
      const res = await runManualTest(selected, numericData);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Manual Disease Testing
        </h1>
        <p className="mt-2 text-slate-400">
          Select a disease and enter your clinical values for AI-powered risk assessment.
        </p>
      </div>

      {/* Disease selector */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {diseases.map((d) => (
          <button
            key={d}
            onClick={() => { setSelected(d); setFormData({}); setResult(null); setError(null); }}
            className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-200 ${
              selected === d
                ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            <span className="text-3xl">{DISEASE_ICONS[d] || "🔬"}</span>
            <span className="text-sm font-medium capitalize text-slate-200">{d}</span>
          </button>
        ))}
      </div>

      {/* Dynamic form */}
      {activeSchema && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold text-white">
            {activeSchema.label}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeSchema.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  {field.label}
                  {field.unit && (
                    <span className="ml-1 text-xs text-slate-500">({field.unit})</span>
                  )}
                </label>
                {field.type === "select" && field.options ? (
                  <select
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step="any"
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.min !== undefined ? `${field.min}–${field.max}` : "Enter value"}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-cyan-500/40 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing...
              </>
            ) : (
              "Run Analysis"
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold text-white">Results</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-400">Risk Level</p>
              <span className={`mt-1 inline-block rounded-full border px-3 py-1 text-sm font-bold ${RISK_COLORS[result.riskLevel] || "text-slate-300"}`}>
                {result.riskLevel || "N/A"}
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-400">Confidence</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {result.confidence != null ? `${(result.confidence * 100).toFixed(1)}%` : "N/A"}
              </p>
            </div>
          </div>
          {result.results && typeof result.results === "object" && !result.results.error && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-sm font-medium text-slate-300">Model Outputs</p>
              <pre className="text-xs text-slate-400 overflow-auto">
                {JSON.stringify(result.results, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
