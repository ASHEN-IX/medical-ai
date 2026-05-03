"use client";

import { useRef, useEffect, useState, memo } from "react";
import Link from "next/link";
import gsap from "gsap";

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#results", label: "Results" },
  { href: "#pipeline", label: "Pipeline" },
];

const NavbarComponent = memo(function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const animationRef = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!navRef.current || animationRef.current) return;
    animationRef.current = true;

    const tl = gsap.timeline();
    tl.fromTo(
      navRef.current,
      { y: -100, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, ease: "power4.out", delay: 0.5 }
    );

    const links = navRef.current.querySelectorAll("[data-nav-link]");
    tl.fromTo(
      links,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: "power3.out" },
      "-=0.5"
    );
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 opacity-0"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/[0.06] bg-black/40 px-6 py-3.5 shadow-[0_0_40px_rgba(124,58,237,0.08)] backdrop-blur-2xl">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 shadow-lg shadow-violet-500/30 transition-shadow group-hover:shadow-violet-500/50">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 opacity-0 blur transition-opacity group-hover:opacity-30" />
            <svg className="relative h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.772.13c-1.687.282-3.4.419-5.113.419H11.5c-1.713 0-3.426-.137-5.113-.419l-.772-.13c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Med<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">AI</span>{" "}
            <span className="text-slate-400 font-light">Nexus</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-nav-link
              className="relative rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-300 hover:text-white group"
            >
              <span className="relative z-10">{link.label}</span>
              <div className="absolute inset-0 rounded-lg bg-white/[0.05] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300 group-hover:w-3/4" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            prefetch={true}
            data-nav-link
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/(dashboard)"
            prefetch={true}
            data-nav-link
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
          >
            <span className="relative z-10">Launch App</span>
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/[0.06] bg-black/80 p-4 backdrop-blur-2xl md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/(dashboard)"
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="mt-3 block rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-center text-sm font-semibold text-white"
          >
            Launch App
          </Link>
        </div>
      )}
    </nav>
  );
});

export default NavbarComponent;
