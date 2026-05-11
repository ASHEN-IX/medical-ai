"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "@/components/FileUploader";
import {
  processReportFile,
  stagedAnalyze,
  submitFollowUpAnswers,
  generateFinalReport,
  type AnalyzeReportPayload,
  type ProcessReportResponse,
  type StagedAnalyzeResponse,
  type FollowUpQuestion,
  type PatientAnswer,
  type SubmitAnswersResponse,
  type FinalReportResponse,
  type ReportType,
} from "@/services/api";

type Step = "upload" | "analyzing" | "questions" | "submitting" | "generating" | "report";

const RISK_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  LOW: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  MEDIUM: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/30" },
  HIGH: { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/30" },
};

function RiskBadge({ level }: { level: string }) {
  const s = RISK_STYLES[level] ?? RISK_STYLES.LOW;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {level}
    </span>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload Report" },
    { key: "analyzing", label: "Analysis" },
    { key: "questions", label: "Follow-Up" },
    { key: "submitting", label: "Processing" },
    { key: "report", label: "Report" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
              isActive ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" :
              isCompleted ? "bg-cyan-500/20 text-cyan-400" :
              "bg-white/5 text-slate-500"
            }`}>
              {isCompleted ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`hidden text-xs font-medium sm:block ${isActive ? "text-white" : "text-slate-500"}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-px w-6 transition-colors ${isCompleted ? "bg-cyan-500/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StagedDiagnosisPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("auto");
  const [error, setError] = useState<string | null>(null);

  const [initialResult, setInitialResult] = useState<StagedAnalyzeResponse | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersResult, setAnswersResult] = useState<SubmitAnswersResponse | null>(null);
  const [finalReport, setFinalReport] = useState<FinalReportResponse | null>(null);

  const handleStartAnalysis = useCallback(async () => {
    if (!file) {
      setError("Please upload a medical report file.");
      return;
    }

    setError(null);
    setStep("analyzing");

    try {
      const extracted = await processReportFile(file);

      const payload: AnalyzeReportPayload = {
        report_type: reportType === "auto" && extracted.report_type ? (extracted.report_type as ReportType) : reportType,
        features: extracted.features || {},
        raw_text: extracted.raw_text,
        include_explanation: true,
        symptoms: [],
        image: imageBase64 || undefined,
      };

      const result = await stagedAnalyze(payload);
      setInitialResult(result);

      if (result.needs_follow_up && result.follow_up_questions.length > 0) {
        setFollowUpQuestions(result.follow_up_questions);
        const initialAnswers: Record<string, string> = {};
        result.follow_up_questions.forEach((q) => { initialAnswers[q.id] = ""; });
        setAnswers(initialAnswers);
        setStep("questions");
      } else {
        setStep("report");
        setFinalReport(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStep("upload");
    }
  }, [file, reportType, imageBase64]);

  const handleSubmitAnswers = useCallback(async () => {
    if (!initialResult) return;

    const patientAnswers: PatientAnswer[] = Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([question_id, answer]) => ({ question_id, answer: answer.trim() }));

    if (patientAnswers.length === 0) {
      setError("Please answer at least one question.");
      return;
    }

    setError(null);
    setStep("submitting");

    try {
      const result = await submitFollowUpAnswers(initialResult.session_id, patientAnswers);
      setAnswersResult(result);

      if (result.needs_more_questions && result.next_questions.length > 0) {
        setFollowUpQuestions(result.next_questions);
        const nextAnswers: Record<string, string> = {};
        result.next_questions.forEach((q) => { nextAnswers[q.id] = ""; });
        setAnswers(nextAnswers);
        setStep("questions");
        return;
      }

      setStep("generating");
      const report = await generateFinalReport(initialResult.session_id);
      setFinalReport(report);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process answers.");
      setStep("questions");
    }
  }, [initialResult, answers]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setImageBase64(null);
    setError(null);
    setInitialResult(null);
    setFollowUpQuestions([]);
    setAnswers({});
    setAnswersResult(null);
    setFinalReport(null);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in">
      {/* Header */}
      <div className="glass-card p-8 border-cyan-500/10">
        <h1 className="text-3xl font-black tracking-tight text-white">Advanced Diagnostics</h1>
        <p className="mt-2 text-slate-400 font-medium">
          Upload your medical report for AI-powered extraction and targeted follow-up analysis.
        </p>
        <div className="mt-8">
          <StepIndicator current={step} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-6 animate-in">
          <div className="glass-card p-8">
            <h2 className="text-xl font-bold text-white">Upload Medical Report</h2>
            <p className="mt-2 text-sm text-slate-400">
              Support for PDF and image formats. The system will automatically extract biomarkers and generate follow-up questions if risks are detected.
            </p>
            <div className="mt-8">
              <FileUploader
                file={file}
                disabled={false}
                onFileSelected={(f, img) => { setFile(f); setImageBase64(img); }}
              />
            </div>
            <div className="mt-8">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80">Diagnostic Model</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              >
                {(["auto", "diabetes", "heart", "kidney", "stroke", "mixed"] as ReportType[]).map((t) => (
                  <option key={t} value={t} className="bg-slate-900">{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleStartAnalysis}
            disabled={!file}
            className="w-full rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 px-6 py-5 font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:shadow-cyan-400/30 disabled:opacity-50 active:scale-[0.99]"
          >
            Analyze Report
          </button>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-16 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-cyan-500 border-t-transparent" />
          <p className="text-lg font-medium text-white">Analyzing your report...</p>
          <p className="text-sm text-white/60">Extracting features, running AI models, and generating follow-up questions.</p>
        </div>
      )}

      {/* Step: Follow-Up Questions */}
      {step === "questions" && initialResult && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Initial Analysis Summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Initial Analysis</h2>
              <RiskBadge level={initialResult.overall_risk} />
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-xs text-white/50">Disease Detected</span>
                <p className="text-sm font-medium text-white">{initialResult.selected_disease?.replace(/_/g, " ") || "General"}</p>
              </div>
              <div>
                <span className="text-xs text-white/50">Confidence</span>
                <p className="text-sm font-medium text-white">{(initialResult.confidence * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-xs text-white/50">Report Type</span>
                <p className="text-sm font-medium text-white">{initialResult.report_type}</p>
              </div>
            </div>
            {initialResult.reasoning.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Reasoning</span>
                <ul className="mt-2 space-y-1">
                  {initialResult.reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/70">
                      <span className="text-cyan-500">-</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Questions */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white">Follow-Up Questions</h2>
            <p className="mt-2 text-sm text-white/60">
              Based on the initial analysis, we need a few more details to refine the diagnosis.
              Answer as many as you can.
            </p>

            <div className="mt-6 space-y-6">
              {followUpQuestions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-white/20">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-400">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{q.text}</p>
                      <p className="mt-1 text-xs text-white/40">{q.reason}</p>

                      <div className="mt-3">
                        {q.answer_type === "yes_no" ? (
                          <div className="flex gap-3">
                            {["Yes", "No"].map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                className={`rounded-lg border px-5 py-2 text-sm font-medium transition-all ${
                                  answers[q.id] === opt
                                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : q.answer_type === "multiple_choice" && q.options.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                                  answers[q.id] === opt
                                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            value={answers[q.id] || ""}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Type your answer..."
                            rows={2}
                            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder-white/30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 backdrop-blur-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmitAnswers}
              disabled={Object.values(answers).every((v) => !v.trim())}
              className="flex-1 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-600/40 to-blue-600/40 px-6 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:border-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              Submit Answers & Generate Report
            </button>
            <button
              onClick={handleReset}
              className="rounded-xl border border-white/20 bg-white/5 px-6 py-4 font-bold text-white transition-all hover:bg-white/10 backdrop-blur-sm"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Step: Submitting / Generating */}
      {(step === "submitting" || step === "generating") && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-16 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-violet-500 border-t-transparent" />
          <p className="text-lg font-medium text-white">
            {step === "submitting" ? "Processing your answers..." : "Generating final report..."}
          </p>
          <p className="text-sm text-white/60">
            {step === "submitting"
              ? "Converting answers to structured features."
              : "Running second-pass analysis with enriched context, RAG, and knowledge graph."}
          </p>
        </div>
      )}

      {/* Step: Final Report */}
      {step === "report" && initialResult && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* No follow-up needed */}
          {!finalReport && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 backdrop-blur-xl">
              <h2 className="text-xl font-bold text-emerald-400">Low Risk - No Follow-Up Needed</h2>
              <p className="mt-2 text-sm text-white/70">
                The initial analysis did not detect a risk level that warrants targeted follow-up questions.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <RiskBadge level={initialResult.overall_risk} />
                <span className="text-sm text-white/50">Confidence: {(initialResult.confidence * 100).toFixed(1)}%</span>
              </div>
              <button
                onClick={handleReset}
                className="mt-6 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
              >
                Start New Diagnosis
              </button>
            </div>
          )}

          {/* Full final report */}
          {finalReport && (() => {
            const uniqueRagContext = Array.from(new Set(finalReport?.rag_context || []));
            const kg = finalReport.kg_insights || {};
            
            // Parse RAG and KG into structured sections
            const symptoms = uniqueRagContext
              .filter(r => r.toLowerCase().includes('symptom'))
              .map(r => r.split(' | ').pop() || r);
            const support = uniqueRagContext
              .filter(r => r.toLowerCase().includes('support') || r.toLowerCase().includes('treatment') || r.toLowerCase().includes('therapy'))
              .map(r => r.split(' | ').pop() || r);
            const riskFactors = Array.isArray(kg.risk_factors) ? kg.risk_factors : [];
            const otherRag = uniqueRagContext
              .filter(r => !r.toLowerCase().includes('symptom') && !r.toLowerCase().includes('support') && !r.toLowerCase().includes('treatment') && !r.toLowerCase().includes('therapy'))
              .map(r => r.split(' | ').pop() || r);

            return (
            <article className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              {/* Section 1: Condition Overview */}
              <div className="border-b border-white/10 pb-6">
                <h2 className="text-lg font-bold text-white">Condition Overview</h2>
                <p className="mt-3 text-sm text-white/75">
                  The clinical analysis focused on <strong>{finalReport.selected_disease?.replace(/_/g, " ") || finalReport.report_type}</strong> based on your reported symptoms, medical history, and follow-up responses.
                </p>
              </div>

              {/* Section 2: Clinical Assessment */}
              <div className="mt-6 border-b border-white/10 pb-6">
                <h2 className="text-lg font-bold text-white">Clinical Assessment</h2>
                
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Initial Finding</span>
                    <div className="mt-3 flex items-center gap-2">
                      <RiskBadge level={finalReport.initial_vs_final.initial_risk} />
                      <span className="text-sm text-white/70">{(finalReport.initial_vs_final.initial_confidence * 100).toFixed(1)}% confidence</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Final Assessment</span>
                    <div className="mt-3 flex items-center gap-2">
                      <RiskBadge level={finalReport.updated_risk} />
                      <span className="text-sm text-white/70">{(finalReport.updated_confidence * 100).toFixed(1)}% confidence</span>
                    </div>
                  </div>
                </div>

                {finalReport.initial_vs_final.risk_changed && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <p className="text-sm text-amber-200">
                      <strong>Change Noted:</strong> Risk reassessment from <strong>{finalReport.initial_vs_final.initial_risk}</strong> to <strong>{finalReport.initial_vs_final.final_risk}</strong> after reviewing follow-up responses.
                    </p>
                  </div>
                )}

                {finalReport.evidence_summary.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-white/90">Clinical Context</h3>
                    <ul className="mt-2 space-y-1">
                      {finalReport.evidence_summary.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs text-white/60">
                          <span className="shrink-0">→</span> {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Section 3: Evidence & Context */}
              <div className="mt-6 border-b border-white/10 pb-6">
                <h2 className="text-lg font-bold text-white">Evidence & Context</h2>
                
                {symptoms.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-cyan-300">Symptoms & Presentation</h3>
                    <div className="mt-3 space-y-2">
                      {symptoms.map((s, i) => (
                        <p key={i} className="text-sm text-white/75 leading-relaxed">{s}</p>
                      ))}
                    </div>
                  </div>
                )}

                {support.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-emerald-300">Support & Treatment Options</h3>
                    <div className="mt-3 space-y-2">
                      {support.map((s, i) => (
                        <p key={i} className="text-sm text-white/75 leading-relaxed">{s}</p>
                      ))}
                    </div>
                  </div>
                )}

                {riskFactors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-amber-300">Related Risk Factors</h3>
                    <ul className="mt-3 space-y-1">
                      {riskFactors.map((rf, i) => (
                        <li key={i} className="flex gap-2 text-sm text-white/75">
                          <span className="shrink-0 text-amber-400">•</span> {rf}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {otherRag.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-violet-300">Additional Context</h3>
                    <div className="mt-3 space-y-2">
                      {otherRag.map((o, i) => (
                        <p key={i} className="text-sm text-white/75 leading-relaxed">{o}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Recommendations */}
              <div className="mt-6 border-b border-white/10 pb-6">
                <h2 className="text-lg font-bold text-white">Recommendations</h2>
                {finalReport.recommendations.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {finalReport.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/75">
                        <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-white/60">No specific recommendations at this time.</p>
                )}
              </div>

              {/* AI Summary and Caveats */}
              <div className="mt-6 space-y-4">
                {finalReport.llm_narrative && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">Clinical Summary</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/70">{finalReport.llm_narrative}</p>
                  </div>
                )}

                {finalReport.missing_caveats.length > 0 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <h3 className="text-sm font-semibold text-amber-300">Important Notes</h3>
                    <ul className="mt-2 space-y-1">
                      {finalReport.missing_caveats.map((c, i) => (
                        <li key={i} className="flex gap-2 text-xs text-amber-100/80">
                          <span className="shrink-0">⚠</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs italic text-white/40">{finalReport.safety_note}</p>
              </div>
            </article>
            );
          })()} 
        </div>
      )}
    </div>
  );
}
