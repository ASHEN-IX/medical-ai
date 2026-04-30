"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.8 });

      tl.fromTo(
        "[data-glitch-text]",
        { opacity: 0, y: 60, skewX: -5 },
        {
          opacity: 1,
          y: 0,
          skewX: 0,
          duration: 1.2,
          ease: "power4.out",
          stagger: 0.08,
        }
      );

      tl.fromTo(
        subRef.current,
        { opacity: 0, y: 30, filter: "blur(10px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out" },
        "-=0.6"
      );

      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.5)" },
        "-=0.4"
      );

      tl.fromTo(
        imageRef.current,
        { opacity: 0, scale: 0.7, rotateY: -15 },
        {
          opacity: 1,
          scale: 1,
          rotateY: 0,
          duration: 1.4,
          ease: "power4.out",
        },
        "-=1.2"
      );

      tl.fromTo(
        "[data-float-badge]",
        { opacity: 0, scale: 0, rotation: -10 },
        {
          opacity: 1,
          scale: 1,
          rotation: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: "back.out(2)",
        },
        "-=0.5"
      );

      // Scanning line animation
      gsap.to(scanLineRef.current, {
        y: "100%",
        duration: 3,
        repeat: -1,
        ease: "none",
        opacity: 0.6,
      });

      // Floating animation for image
      gsap.to(imageRef.current, {
        y: -15,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Pulse glow effect
      gsap.to("[data-glow-pulse]", {
        scale: 1.1,
        opacity: 0.6,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="home"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-24"
    >
      {/* Scan lines overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-2">
        {/* Left Content */}
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              Neural Engine Active
            </span>
          </div>

          <h1
            ref={headingRef}
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-7xl"
          >
            <span data-glitch-text className="block">Transform</span>
            <span data-glitch-text className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Medical Analysis
            </span>
            <span data-glitch-text className="block">With AI Agents</span>
          </h1>

          <p
            ref={subRef}
            className="mt-6 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg opacity-0"
          >
            Autonomous AI systems analyzing medical reports 24/7 — extracting features,
            predicting risk, and generating explanations with{" "}
            <span className="text-cyan-400">97.8% accuracy</span>.
          </p>

          <div ref={ctaRef} className="mt-10 flex flex-wrap items-center gap-4 opacity-0">
            <Link
              href="/upload"
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 p-[1px] shadow-[0_0_30px_rgba(124,58,237,0.3)] transition-shadow hover:shadow-[0_0_50px_rgba(124,58,237,0.5)]"
            >
              <div className="relative rounded-2xl bg-black/50 px-8 py-4 backdrop-blur-xl transition-all group-hover:bg-black/30">
                <span className="relative z-10 text-sm font-semibold text-white">
                  Start Analysis →
                </span>
              </div>
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-8 py-4 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
              </svg>
              Watch Demo
            </a>
          </div>

          {/* Metrics */}
          <div className="mt-12 flex items-center gap-8">
            <div className="border-r border-white/10 pr-8">
              <p className="text-2xl font-bold text-white">98<span className="text-violet-400">+</span></p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Active Users</p>
            </div>
            <div className="border-r border-white/10 pr-8">
              <p className="text-2xl font-bold text-white">24<span className="text-cyan-400">/7</span></p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">AI Uptime</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">6<span className="text-fuchsia-400">ms</span></p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Response</p>
            </div>
          </div>
        </div>

        {/* Right - AI Head */}
        <div ref={imageRef} className="relative flex items-center justify-center opacity-0">
          {/* Glow effects */}
          <div data-glow-pulse className="absolute h-[600px] w-[600px] rounded-full bg-gradient-radial from-violet-600/20 via-purple-500/5 to-transparent" />
          <div className="absolute h-[400px] w-[400px] rounded-full bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-xl" />

          {/* Holographic ring */}
          <div className="absolute h-[450px] w-[450px] animate-[spin_20s_linear_infinite] rounded-full border border-violet-500/20" />
          <div className="absolute h-[500px] w-[500px] animate-[spin_30s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-500/10" />

          {/* Main image */}
          <div className="relative">
            {/* Scan line */}
            <div
              ref={scanLineRef}
              className="absolute inset-x-0 top-0 z-30 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0"
            />

            <Image
              src="/head.png"
              alt="MedAI Nexus"
              width={580}
              height={580}
              className="relative z-10 drop-shadow-[0_0_60px_rgba(124,58,237,0.4)]"
              priority
            />
          </div>

          {/* Floating data badges */}
          <div ref={badgesRef}>
            <div
              data-float-badge
              className="absolute -left-8 top-1/4 z-20 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-xl opacity-0"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500">System Status</p>
              </div>
              <p className="mt-1 text-lg font-bold text-emerald-400">Online</p>
            </div>

            <div
              data-float-badge
              className="absolute -right-4 top-1/3 z-20 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 shadow-[0_0_20px_rgba(124,58,237,0.1)] backdrop-blur-xl opacity-0"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Accuracy</p>
              <p className="mt-1 text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">97.8%</p>
            </div>

            <div
              data-float-badge
              className="absolute bottom-1/4 -left-4 z-20 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 shadow-[0_0_20px_rgba(124,58,237,0.1)] backdrop-blur-xl opacity-0"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Models Active</p>
              <p className="mt-1 text-lg font-bold text-violet-400">12</p>
            </div>

            <div
              data-float-badge
              className="absolute -right-8 bottom-1/3 z-20 rounded-xl border border-white/[0.08] bg-black/60 px-4 py-3 shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-xl opacity-0"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Processing</p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                <p className="text-lg font-bold text-cyan-400">Live</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
