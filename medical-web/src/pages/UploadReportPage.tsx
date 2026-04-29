"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import FileUploader from "@/components/FileUploader";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import type { AnalyzeReportPayload, ReportType } from "@/services/api";

const REPORT_TYPES: ReportType[] = ["auto", "diabetes", "heart", "kidney", "stroke", "mixed"];

const FEATURE_FIELDS: Array<{ key: keyof AnalyzeReportPayload["features"] | string; label: string; placeholder: string }> = [
  { key: "glucose", label: "Glucose (mg/dL)", placeholder: "180" },
  { key: "blood_pressure", label: "Blood Pressure (systolic)", placeholder: "140" },
  { key: "cholesterol", label: "Cholesterol (mg/dL)", placeholder: "220" },
  { key: "age", label: "Age", placeholder: "45" },
];

export default function UploadReportPage() {
  const router = useRouter();
  const { analyze, loading, error, clearError } = useAIAnalysis();

  const [reportType, setReportType] = useState<ReportType>("auto");
  const [includeExplanation, setIncludeExplanation] = useState(true);
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({
    glucose: "",
    blood_pressure: "",
    cholesterol: "",
    age: "",
  });
  const [symptomsInput, setSymptomsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateFeature = (field: string, value: string) => {
    setFeatureValues((previous) => ({ ...previous, [field]: value }));
  };

  const buildPayload = (): AnalyzeReportPayload | null => {
    const features: Record<string, number> = {};

    for (const [key, rawValue] of Object.entries(featureValues)) {
      if (!rawValue.trim()) {
        continue;
      }

      const parsed = Number(rawValue);
      if (Number.isNaN(parsed) || parsed < 0) {
        setFormError(`Invalid ${key.replace("_", " ")} value.`);
        return null;
      }

      features[key] = parsed;
    }

    const symptoms = symptomsInput
      .split(",")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (Object.keys(features).length === 0 && !imageBase64 && symptoms.length === 0) {
      setFormError("Provide at least one clinical feature, symptom, or image file to analyze.");
      return null;
    }

    return {
      report_type: reportType,
      features,
      include_explanation: includeExplanation,
      symptoms,
      image: imageBase64 || undefined,
    };
  };

  const handleAnalyze = async () => {
    clearError();
    setFormError(null);

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    try {
      const historyItem = await analyze(payload);
      router.push(`/results?id=${historyItem.id}`);
    } catch {
      // Error state is handled by the hook and shown in UI.
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-cyan-100/30 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">MedAI Nexus Analysis Intake</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload a report and provide structured clinical indicators. The AI Gateway will route and orchestrate
          specialized medical models.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-lg shadow-cyan-100/20 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">1) Upload Medical Report</h2>
          <p className="mt-1 text-sm text-slate-500">
            Drag & drop report files (PDF or image). Image uploads can also trigger image-driven AI routing.
          </p>

          <div className="mt-5">
            <FileUploader
              file={file}
              disabled={loading}
              onFileSelected={(nextFile, encodedImage) => {
                setFile(nextFile);
                setImageBase64(encodedImage);
              }}
            />
          </div>

          {file && !imageBase64 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              PDF uploads are supported for record tracking. Add at least one feature or symptom so the gateway can
              perform structured analysis.
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-lg shadow-cyan-100/20 backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">2) Clinical Feature Input</h2>
          <p className="mt-1 text-sm text-slate-500">Manual fallback for precise AI Gateway routing and risk estimation.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FEATURE_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{field.label}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={featureValues[field.key] || ""}
                  onChange={(event) => updateFeature(field.key, event.target.value)}
                  disabled={loading}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500" htmlFor="symptoms">
              Neurological Symptoms (comma separated)
            </label>
            <input
              id="symptoms"
              type="text"
              value={symptomsInput}
              onChange={(event) => setSymptomsInput(event.target.value)}
              disabled={loading}
              placeholder="slurred speech, facial droop"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Report Type</span>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-3 py-2">
              <input
                type="checkbox"
                checked={includeExplanation}
                onChange={(event) => setIncludeExplanation(event.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
              />
              <span className="text-sm text-slate-700">Include explanation reasoning</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-lg shadow-cyan-100/20 backdrop-blur">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">3) Run AI Analysis</h2>
            <p className="mt-1 text-sm text-slate-500">Upload → Analyze → Visualize → Store → Review</p>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Analyzing..." : "Analyze with AI Gateway"}
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" />
              </div>
              <span>AI Gateway is orchestrating medical models...</span>
            </div>
          </div>
        ) : null}

        {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
