"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "@/components/FileUploader";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { processReportFile, type AnalyzeReportPayload, type ProcessReportResponse, type ReportType, runManualModels, type ManualModelRunResponse } from "@/services/api";

const REPORT_TYPES: ReportType[] = ["auto", "diabetes", "heart", "kidney", "stroke", "autism", "mixed"];
const AVAILABLE_MODELS = ["diabetes", "heart", "kidney", "stroke", "autism_dl", "autism_pred"];

const FEATURE_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "glucose", label: "Glucose (mg/dL)", placeholder: "180" },
  { key: "blood_pressure", label: "Blood Pressure (systolic)", placeholder: "140" },
  { key: "cholesterol", label: "Cholesterol (mg/dL)", placeholder: "220" },
  { key: "age", label: "Age", placeholder: "45" },
];

export default function UploadReportPage() {
  const router = useRouter();
  const { analyze, loading: gatewayLoading, error: gatewayError, clearError } = useAIAnalysis();

  // Tab state
  const [tab, setTab] = useState<"upload" | "manual">("upload");

  // Report Upload tab state
  const [reportType, setReportType] = useState<ReportType>("auto");
  const [includeExplanation, setIncludeExplanation] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [processedReport, setProcessedReport] = useState<ProcessReportResponse | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Manual testing tab state
  const [manualFeatures, setManualFeatures] = useState<Record<string, string>>({
    glucose: "",
    blood_pressure: "",
    skin_thickness: "",
    insulin: "",
    bmi: "",
    diabetes_pedigree_function: "",
    age: "",
  });
  const [manualSymptoms, setManualSymptoms] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<ManualModelRunResponse | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const updateManualFeature = (field: string, value: string) => {
    setManualFeatures((prev) => ({ ...prev, [field]: value }));
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => (prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]));
  };

  // Report Upload workflow
  const handleReportAnalyze = async () => {
    clearError();
    setReportError(null);

    if (!file) {
      setReportError("Please upload a medical report file.");
      return;
    }

    try {
      let reportExtraction: ProcessReportResponse | null = processedReport;
      if (!reportExtraction) {
        reportExtraction = await processReportFile(file);
        setProcessedReport(reportExtraction);
      }

      const payload: AnalyzeReportPayload = {
        report_type: reportType === "auto" && reportExtraction?.report_type
          ? (reportExtraction.report_type as ReportType)
          : reportType,
        features: reportExtraction?.features || {},
        raw_text: reportExtraction?.raw_text,
        include_explanation: includeExplanation,
        symptoms: [],
        image: imageBase64 || undefined,
      };

      const historyItem = await analyze(payload);
      router.push("/results");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Analysis failed.");
    }
  };

  // Manual Testing workflow
  const handleManualRun = async () => {
    if (selectedModels.length === 0) {
      setManualError("Select at least one model.");
      return;
    }

    setManualResult(null);
    setManualError(null);
    setManualLoading(true);

    try {
      const features: Record<string, number> = {};
      for (const [key, rawValue] of Object.entries(manualFeatures)) {
        if (!rawValue.trim()) continue;
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed) || parsed < 0) {
          setManualError(`Invalid ${key.replace("_", " ")} value.`);
          setManualLoading(false);
          return;
        }
        features[key] = parsed;
      }

      const symptoms = manualSymptoms.split(",").map((s) => s.trim()).filter(Boolean);

      if (Object.keys(features).length === 0 && symptoms.length === 0) {
        setManualError("Provide at least one clinical feature or symptom.");
        setManualLoading(false);
        return;
      }

      const payload: AnalyzeReportPayload = {
        report_type: "auto",
        features,
        symptoms,
        include_explanation: false,
      };

      const res = await runManualModels(selectedModels, payload);
      setManualResult(res);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Manual run failed.");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
          <h1 className="text-4xl font-bold tracking-tight text-white">MedAI Nexus</h1>
          <p className="mt-3 text-lg text-white/80">
            Advanced Medical Analysis & Model Testing Platform
          </p>
          <p className="mt-2 text-sm text-white/60">
            Your tests are private and secure. Only authorized healthcare providers can access your data.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl transition-all duration-500">
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 rounded-xl px-6 py-3 font-semibold transition-all duration-300 ${
              tab === "upload"
                ? "border border-white/20 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 text-white shadow-lg shadow-cyan-500/20"
                : "border border-transparent text-white/60 hover:text-white/80"
            }`}
          >
            📋 Report Upload
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 rounded-xl px-6 py-3 font-semibold transition-all duration-300 ${
              tab === "manual"
                ? "border border-white/20 bg-gradient-to-r from-violet-500/40 to-purple-500/40 text-white shadow-lg shadow-violet-500/20"
                : "border border-transparent text-white/60 hover:text-white/80"
            }`}
          >
            🧪 Manual Testing
          </button>
        </div>

        {/* Report Upload Tab */}
        {tab === "upload" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Report Upload */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
              <h2 className="text-2xl font-bold text-white">Upload Medical Report</h2>
              <p className="mt-2 text-sm text-white/60">
                Upload a PDF or medical image. Our system will extract and analyze the content.
              </p>

              <div className="mt-6">
                <FileUploader
                  file={file}
                  disabled={gatewayLoading}
                  onFileSelected={(f, img) => {
                    setFile(f);
                    setImageBase64(img);
                    setProcessedReport(null);
                  }}
                />
              </div>

              {processedReport && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 backdrop-blur-sm transition-all duration-300">
                  ✓ Report extracted with {Object.keys(processedReport.features).length} features
                </div>
              )}
            </div>

            {/* Report Configuration */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
                <label className="text-sm font-semibold uppercase tracking-wider text-white">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as ReportType)}
                  disabled={gatewayLoading}
                  className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 backdrop-blur-sm"
                >
                  {REPORT_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-slate-900">{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeExplanation}
                    onChange={(e) => setIncludeExplanation(e.target.checked)}
                    disabled={gatewayLoading}
                    className="h-4 w-4 rounded border-white/30 bg-white/10"
                  />
                  <span className="text-sm font-semibold uppercase tracking-wider text-white">Include Explanation</span>
                </label>
              </div>
            </div>

            {/* Errors */}
            {reportError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm transition-all duration-300">
                {reportError}
              </div>
            )}
            {gatewayError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm transition-all duration-300">
                {gatewayError}
              </div>
            )}

            {/* Analyze Button */}
            <button
              onClick={handleReportAnalyze}
              disabled={gatewayLoading || !file}
              className="w-full rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-600/40 to-blue-600/40 px-6 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              {gatewayLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  Analyzing...
                </span>
              ) : (
                "Analyze with AI Gateway"
              )}
            </button>
          </div>
        )}

        {/* Manual Testing Tab */}
        {tab === "manual" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Clinical Features */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
              <h2 className="text-2xl font-bold text-white">Clinical Features</h2>
              <p className="mt-2 text-sm text-white/60">
                Enter numeric medical indicators for model analysis.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {FEATURE_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/80">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={manualFeatures[field.key] || ""}
                      onChange={(e) => updateManualFeature(field.key, e.target.value)}
                      disabled={manualLoading}
                      placeholder={field.placeholder}
                      className="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white outline-none transition placeholder-white/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 backdrop-blur-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Symptoms */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
              <label className="text-sm font-semibold uppercase tracking-wider text-white">Symptoms (comma-separated)</label>
              <input
                type="text"
                value={manualSymptoms}
                onChange={(e) => setManualSymptoms(e.target.value)}
                disabled={manualLoading}
                placeholder="fever, headache, nausea"
                className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder-white/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 backdrop-blur-sm"
              />
            </div>

            {/* Model Selection */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
              <h2 className="text-2xl font-bold text-white">Select Models</h2>
              <p className="mt-2 text-sm text-white/60">
                Choose which models to run for analysis.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {AVAILABLE_MODELS.map((model) => (
                  <label
                    key={model}
                    className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/5 px-4 py-3 cursor-pointer transition-all duration-300 hover:border-white/40 hover:bg-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model)}
                      onChange={() => toggleModel(model)}
                      disabled={manualLoading}
                      className="h-4 w-4 rounded border-white/30 bg-white/10"
                    />
                    <span className="font-medium text-white">{model}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Errors */}
            {manualError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm transition-all duration-300">
                {manualError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleManualRun}
                disabled={manualLoading || selectedModels.length === 0}
                className="flex-1 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-600/40 to-purple-600/40 px-6 py-4 font-bold text-white shadow-lg shadow-violet-500/20 transition-all duration-300 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-400/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                {manualLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
                    Running...
                  </span>
                ) : (
                  "Run Selected Models"
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedModels([]);
                  setManualResult(null);
                  setManualError(null);
                }}
                disabled={manualLoading}
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-4 font-bold text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              >
                Clear
              </button>
            </div>

            {/* Results */}
            {manualResult && (
              <div className="animate-in fade-in duration-500 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10">
                <h2 className="text-2xl font-bold text-white">Analysis Results</h2>

                {/* Success Results */}
                {Object.keys(manualResult.results).length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-semibold text-white">Model Predictions</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Object.entries(manualResult.results).map(([model, result]) => (
                        <div
                          key={model}
                          className="rounded-lg border border-white/20 bg-white/5 p-4 transition-all duration-300 hover:border-white/40 hover:bg-white/10 backdrop-blur-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">{model}</span>
                            <span
                              className={`rounded-lg px-3 py-1 text-xs font-bold transition-all duration-300 ${
                                result.risk === "HIGH"
                                  ? "bg-red-500/30 text-red-200 border border-red-500/30"
                                  : result.risk === "MEDIUM"
                                  ? "bg-yellow-500/30 text-yellow-200 border border-yellow-500/30"
                                  : "bg-green-500/30 text-green-200 border border-green-500/30"
                              }`}
                            >
                              {result.risk}
                            </span>
                          </div>
                          <div className="mt-3 text-sm text-white/70">
                            Confidence: <span className="font-semibold text-white">{(result.confidence * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failures */}
                {Object.keys(manualResult.failures || {}).length > 0 && (
                  <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 backdrop-blur-sm">
                    <h3 className="font-semibold text-red-200">Failures</h3>
                    <ul className="mt-2 space-y-1 text-sm text-red-300">
                      {Object.entries(manualResult.failures || {}).map(([model, error]) => (
                        <li key={model}>
                          <strong>{model}:</strong> {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Raw JSON */}
                <details className="mt-6">
                  <summary className="cursor-pointer font-semibold text-white/80 transition-colors hover:text-white">
                    View raw response
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/20 bg-black/30 p-4 text-xs text-white/70 backdrop-blur-sm">
                    {JSON.stringify(manualResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
