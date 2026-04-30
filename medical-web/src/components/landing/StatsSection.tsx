"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  {
    value: 95,
    suffix: "%",
    label: "Prediction Accuracy",
    description: "ML/DL models achieve near-specialist accuracy in multi-disease risk scoring.",
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/20",
    glowColor: "shadow-violet-500/10",
  },
  {
    value: 78,
    suffix: "%",
    label: "Faster Analysis",
    description: "Automated OCR + NLP pipelines reduce manual report analysis time dramatically.",
    color: "from-cyan-500 to-blue-600",
    borderColor: "border-cyan-500/20",
    glowColor: "shadow-cyan-500/10",
  },
  {
    value: 89,
    suffix: "%",
    label: "Cost Reduction",
    description: "Eliminate repetitive diagnostic workflows with autonomous AI agents.",
    color: "from-fuchsia-500 to-pink-600",
    borderColor: "border-fuchsia-500/20",
    glowColor: "shadow-fuchsia-500/10",
  },
];

export default function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Animate heading
      gsap.fromTo(
        "[data-stats-heading]",
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          },
        }
      );

      // Animate cards
      gsap.fromTo(
        "[data-stat-card]",
        { opacity: 0, y: 60, rotateX: 15 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: "power4.out",
          scrollTrigger: {
            trigger: "[data-stat-card]",
            start: "top 85%",
          },
        }
      );

      // Counter animation
      counterRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          { val: 0 },
          { val: 0 },
          {
            val: stats[i].value,
            duration: 2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
            },
            onUpdate: function () {
              if (el) el.textContent = Math.round(this.targets()[0].val).toString();
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="results" className="relative px-4 py-32">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(124,58,237,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="mx-auto max-w-7xl">
        <div data-stats-heading className="mb-20 text-center opacity-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Proven Metrics
          </p>
          <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Proven Results For{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Clinical Practice
            </span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              data-stat-card
              className={`group relative overflow-hidden rounded-3xl border ${stat.borderColor} bg-white/[0.02] p-8 backdrop-blur-md transition-all duration-500 hover:bg-white/[0.05] hover:shadow-2xl ${stat.glowColor} hover:border-white/20 opacity-0`}
              style={{ perspective: "1000px" }}
            >
              {/* Corner accent */}
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
              />
              <div className={`absolute right-4 top-4 h-16 w-16 rounded-full bg-gradient-to-br ${stat.color} opacity-0 blur-xl transition-opacity group-hover:opacity-30`} />

              {/* Counter */}
              <div className="flex items-baseline gap-1">
                <span
                  ref={(el) => { counterRefs.current[i] = el; }}
                  className={`bg-gradient-to-r ${stat.color} bg-clip-text text-6xl font-bold text-transparent`}
                >
                  0
                </span>
                <span className={`bg-gradient-to-r ${stat.color} bg-clip-text text-4xl font-bold text-transparent`}>
                  {stat.suffix}
                </span>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-white">{stat.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{stat.description}</p>

              {/* Progress bar */}
              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${stat.color} transition-all duration-1000 group-hover:w-full`}
                  style={{ width: "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
