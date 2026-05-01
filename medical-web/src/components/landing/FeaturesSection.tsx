"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: "⚡",
    title: "OCR + NLP Pipeline",
    description: "Tesseract OCR extracts text from scanned reports, spaCy NLP structures medical entities into clean features.",
    gradient: "from-blue-500 to-cyan-400",
    delay: 0,
  },
  {
    icon: "🧠",
    title: "AI Agent Routing",
    description: "Intelligent agent analyzes report type and routes to optimal ML model — autism, kidney, diabetes, and more.",
    gradient: "from-violet-500 to-purple-400",
    delay: 0.1,
  },
  {
    icon: "📊",
    title: "ML/DL Predictions",
    description: "Ensemble models with SHAP explainability provide confidence-scored risk assessments with feature importance.",
    gradient: "from-pink-500 to-rose-400",
    delay: 0.2,
  },
  {
    icon: "🔍",
    title: "RAG Knowledge Base",
    description: "FAISS vector search retrieves relevant medical literature from indexed research papers for evidence backing.",
    gradient: "from-amber-500 to-orange-400",
    delay: 0.3,
  },
  {
    icon: "🧬",
    title: "Knowledge Graph",
    description: "Neo4j graph reasoning maps symptoms → conditions → treatments for holistic diagnostic pathways.",
    gradient: "from-emerald-500 to-teal-400",
    delay: 0.4,
  },
  {
    icon: "💬",
    title: "LLM Explanations",
    description: "GPT-4 generates human-readable clinical explanations with inline citations from retrieved evidence.",
    gradient: "from-indigo-500 to-blue-400",
    delay: 0.5,
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-feature-heading]",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
          },
        }
      );

      gsap.fromTo(
        "[data-feature-card]",
        { opacity: 0, y: 50, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "power4.out",
          scrollTrigger: {
            trigger: "[data-feature-card]",
            start: "top 85%",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pipeline" className="relative px-4 py-32">
      <div className="mx-auto max-w-7xl">
        <div data-feature-heading className="mb-20 text-center opacity-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            AI Pipeline
          </p>
          <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
            End-to-End Intelligence{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Pipeline
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500">
            From raw report to clinical insight in milliseconds. Six interconnected AI modules working in harmony.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              data-feature-card
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur-sm transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] opacity-0"
            >
              {/* Hover glow */}
              <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25`} />

              {/* Number indicator */}
              <div className="absolute right-4 top-4 text-[64px] font-bold leading-none text-white/[0.03] transition-colors group-hover:text-white/[0.06]">
                {String(i + 1).padStart(2, "0")}
              </div>

              {/* Icon */}
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-2xl shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                {feature.icon}
              </div>

              <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.description}</p>

              {/* Bottom line accent */}
              <div className={`mt-6 h-[2px] w-0 rounded-full bg-gradient-to-r ${feature.gradient} transition-all duration-500 group-hover:w-full`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
