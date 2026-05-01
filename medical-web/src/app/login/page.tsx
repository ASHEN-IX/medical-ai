"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginForm>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof LoginForm]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});
    setLoading(true);

    try {
      const validated = loginSchema.parse(formData);
      await login(validated.email, validated.password);
      setSuccess(true);
      const storedUser = localStorage.getItem("user");
      const role = storedUser ? JSON.parse(storedUser).role : "PATIENT";
      const dest = role === "DOCTOR" || role === "ADMIN" ? "/doctor" : "/upload";
      setTimeout(() => {
        router.push(dest);
      }, 500);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof LoginForm, string>> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as keyof LoginForm] = error.message;
          }
        });
        setErrors(fieldErrors);
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h1 className="text-2xl font-bold">Login successful!</h1>
          <p className="mt-2 text-slate-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            MedAI Nexus
          </h1>
          <p className="mt-2 text-slate-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">Email address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                placeholder="you@example.com"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition ${
                  errors.email
                    ? "border-red-500 bg-red-500/10 focus:ring-2 focus:ring-red-500"
                    : "border-white/10 bg-white/5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                }`}
              />
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition ${
                  errors.password
                    ? "border-red-500 bg-red-500/10 focus:ring-2 focus:ring-red-500"
                    : "border-white/10 bg-white/5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                }`}
              />
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            {generalError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {generalError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:shadow-lg hover:shadow-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-cyan-400 hover:text-cyan-300">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
