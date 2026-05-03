"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    role: z.enum(["PATIENT", "DOCTOR"]),
    age: z.number().min(1).max(150).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
    medicalBackground: z.string().optional(),
    specialty: z.string().optional(),
    licenseNo: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "PATIENT" | "DOCTOR";
  age: string;
  gender: string;
  medicalBackground: string;
  specialty: string;
  licenseNo: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "PATIENT",
    age: "",
    gender: "",
    medicalBackground: "",
    specialty: "",
    licenseNo: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});
    setLoading(true);

    try {
      const parsed = registerSchema.parse({
        ...form,
        age: form.age ? parseInt(form.age) : undefined,
        gender: form.gender || undefined,
        medicalBackground: form.medicalBackground || undefined,
        specialty: form.specialty || undefined,
        licenseNo: form.licenseNo || undefined,
      });

      await register({
        name: parsed.name,
        email: parsed.email,
        password: parsed.password,
        role: parsed.role,
        age: parsed.age,
        gender: parsed.gender,
        medicalBackground: parsed.medicalBackground,
        specialty: parsed.specialty,
        licenseNo: parsed.licenseNo,
      });

      setSuccess(true);
      setTimeout(() => router.push("/diagnosis"), 800);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fe: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fe[String(e.path[0])] = e.message;
        });
        setErrors(fe);
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400">
            &#10003;
          </div>
          <h1 className="text-2xl font-bold">Account created!</h1>
          <p className="mt-2 text-slate-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition ${
      errors[field]
        ? "border-red-500 bg-red-500/10 focus:ring-2 focus:ring-red-500"
        : "border-white/10 bg-white/5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            MedAI Nexus
          </h1>
          <p className="mt-2 text-slate-400">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {(["PATIENT", "DOCTOR"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, role: r }))}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      form.role === r
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {r === "PATIENT" ? "Patient" : "Doctor"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">Full name</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} disabled={loading}
                placeholder="John Doe" className={inputClass("name")} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">Email address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} disabled={loading}
                placeholder="you@example.com" className={inputClass("email")} />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-200">Password</label>
                <input type="password" name="password" value={form.password} onChange={handleChange}
                  disabled={loading} placeholder="Min 8 chars" className={inputClass("password")} />
                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">Confirm</label>
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                  disabled={loading} placeholder="Re-enter" className={inputClass("confirmPassword")} />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Profile Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-200">Age</label>
                <input type="number" name="age" value={form.age} onChange={handleChange} disabled={loading}
                  placeholder="30" min="1" max="150" className={inputClass("age")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange} disabled={loading}
                  className={inputClass("gender")}>
                  <option value="" className="bg-slate-900">Select</option>
                  <option value="MALE" className="bg-slate-900">Male</option>
                  <option value="FEMALE" className="bg-slate-900">Female</option>
                  <option value="OTHER" className="bg-slate-900">Other</option>
                  <option value="PREFER_NOT_TO_SAY" className="bg-slate-900">Prefer not to say</option>
                </select>
              </div>
            </div>

            {form.role === "PATIENT" && (
              <div>
                <label className="block text-sm font-medium text-slate-200">Medical background (optional)</label>
                <textarea name="medicalBackground" value={form.medicalBackground} onChange={handleChange}
                  disabled={loading} placeholder="Known conditions, allergies, medications..."
                  rows={2} className={inputClass("medicalBackground") + " resize-none"} />
              </div>
            )}

            {form.role === "DOCTOR" && (
              <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Doctor Details</p>
                <div>
                  <label className="block text-sm font-medium text-slate-200">Specialty</label>
                  <input type="text" name="specialty" value={form.specialty} onChange={handleChange}
                    disabled={loading} placeholder="Cardiology, Neurology..."
                    className={inputClass("specialty")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">License Number (optional)</label>
                  <input type="text" name="licenseNo" value={form.licenseNo} onChange={handleChange}
                    disabled={loading} placeholder="MD-12345"
                    className={inputClass("licenseNo")} />
                </div>
              </div>
            )}

            {generalError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {generalError}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-cyan-400 hover:text-cyan-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
