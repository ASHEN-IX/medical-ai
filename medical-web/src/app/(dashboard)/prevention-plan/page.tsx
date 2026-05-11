"use client";

import { useState, useEffect } from "react";
import { fetchActivePreventionPlan, generatePreventionPlan } from "@/services/api";

const SECTION_ICONS: Record<string, string> = {
  dietGuidance: "🥗", exercisePlan: "🏃", sleepAdvice: "😴",
  stressManagement: "🧘", followUpTests: "🔬",
};

const SECTION_TITLES: Record<string, string> = {
  dietGuidance: "Diet & Nutrition",
  exercisePlan: "Exercise Plan",
  sleepAdvice: "Sleep Optimization",
  stressManagement: "Stress Management",
  followUpTests: "Follow-Up Tests",
};

export default function PreventionPlanPage() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchActivePreventionPlan().then(setPlan).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const newPlan = await generatePreventionPlan();
      setPlan(newPlan);
    } catch { /* empty */ }
    setGenerating(false);
  };

  const sections = ["dietGuidance", "exercisePlan", "sleepAdvice", "stressManagement", "followUpTests"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Prevention Plan</h1>
          <p className="mt-1 text-slate-400">Personalized AI-generated lifestyle recommendations.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50"
        >
          {generating ? "Generating..." : plan ? "Regenerate Plan" : "Generate Plan"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading...
        </div>
      ) : !plan ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-slate-400">
          <p className="text-4xl mb-2">🌿</p>
          <p>No prevention plan yet. Generate one based on your health data.</p>
        </div>
      ) : (
        <>
          {/* Diagnoses badges */}
          {plan.diagnoses?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.diagnoses.map((d: string) => (
                <span key={d} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium capitalize text-cyan-300">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Plan sections */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((key) => {
              const items = plan[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
                    <span>{SECTION_ICONS[key]}</span>
                    {SECTION_TITLES[key]}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {plan.additionalNotes && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-slate-400">{plan.additionalNotes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
