"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-cta-content]",
        { opacity: 0, y: 40, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
          },
        }
      );

      // Orbiting particles
      gsap.to("[data-orbit-1]", {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });

      gsap.to("[data-orbit-2]", {
        rotation: -360,
        duration: 30,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative px-4 py-32">
      <div className="mx-auto max-w-5xl">
        <div
          data-cta-content
          className="relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-gradient-to-br from-violet-950/40 via-black/60 to-cyan-950/40 p-12 text-center backdrop-blur-xl sm:p-20 opacity-0"
        >
          {/* Animated orbit rings */}
          <div data-orbit-1 className="absolute inset-0 m-auto h-[400px] w-[400px] rounded-full border border-violet-500/10" />
          <div data-orbit-2 className="absolute inset-0 m-auto h-[500px] w-[500px] rounded-full border border-dashed border-cyan-500/10" />

          {/* Corner glows */}
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-600/20 blur-[80px]" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-cyan-600/15 blur-[80px]" />

          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-cyan-600/20 backdrop-blur">
              <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Ready to Transform Your Practice?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 leading-relaxed">
              Deploy AI-powered medical analysis in minutes. No infrastructure to manage.
              Full transparency. Enterprise-grade security.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/upload"
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 p-[1px] shadow-[0_0_40px_rgba(124,58,237,0.3)] transition-shadow hover:shadow-[0_0_60px_rgba(124,58,237,0.5)]"
              >
                <div className="rounded-2xl bg-black/40 px-10 py-4 backdrop-blur-xl transition-all group-hover:bg-black/20">
                  <span className="text-sm font-semibold text-white">Get Started Free</span>
                </div>
              </Link>
              <Link
                href="#features"
                className="rounded-2xl border border-white/10 bg-white/[0.02] px-10 py-4 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Documentation
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
              {["HIPAA Compliant", "No Credit Card", "24/7 Availability", "SOC 2 Type II"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
