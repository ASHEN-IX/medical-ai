"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";

type ConsentEntry = {
  id: string;
  patientId: string;
  caregiverId: string;
  scope: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  caregiver?: { id: string; name: string; email: string };
  patient?: { id: string; name: string; email: string };
};

export default function CaregiversPage() {
  const { user } = useAuth();
  const [caregivers, setCaregivers] = useState<ConsentEntry[]>([]);
  const [patients, setPatients] = useState<ConsentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);
  
  const [form, setForm] = useState({
    caregiverIdOrEmail: "",
    accessLevel: "FULL_ACCESS",
    expiresAt: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cgRes, ptRes] = await Promise.all([
        apiClient.get("/family-consent/caregivers"),
        apiClient.get("/family-consent/patients"),
      ]);
      setCaregivers(cgRes.data);
      setPatients(ptRes.data);
    } catch (err) {
      console.error("Failed to load consent data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    try {
      // Note: In a real app, you'd probably search for user by email first
      await apiClient.post("/family-consent/grant", {
        caregiverId: form.caregiverIdOrEmail,
        accessLevel: form.accessLevel,
        expiresAt: form.expiresAt || undefined,
      });
      setForm({ caregiverIdOrEmail: "", accessLevel: "FULL_ACCESS", expiresAt: "" });
      loadData();
    } catch (err) {
      alert("Failed to grant consent. Please check the Caregiver ID.");
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (caregiverId: string) => {
    if (!confirm("Are you sure you want to revoke access?")) return;
    try {
      await apiClient.patch(`/family-consent/revoke/${caregiverId}`);
      loadData();
    } catch (err) {
      alert("Failed to revoke consent.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Family & Caregiver Access</h1>
        <p className="mt-2 text-sm text-white/50">
          Manage who can access your medical records and whose records you can view.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Grant Access Form */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold text-white">Grant New Access</h2>
          <p className="mt-2 text-xs text-white/40">Provide a Caregiver ID to delegate access to your clinical dashboard.</p>
          
          <form onSubmit={handleGrant} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Caregiver User ID</label>
              <input
                type="text"
                required
                value={form.caregiverIdOrEmail}
                onChange={(e) => setForm({ ...form, caregiverIdOrEmail: e.target.value })}
                placeholder="Enter User ID..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 transition"
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Access Level</label>
                <select
                  value={form.accessLevel}
                  onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 transition"
                >
                  <option value="FULL_ACCESS">Full Access</option>
                  <option value="VIEW_ONLY">View Only</option>
                  <option value="EMERGENCY_ONLY">Emergency Only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Expires At (Optional)</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={granting}
              className="w-full rounded-xl bg-cyan-600 px-6 py-4 font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {granting ? "Processing..." : "Authorize Caregiver"}
            </button>
          </form>
        </section>

        {/* My Caregivers List */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold text-white">Authorized Caregivers</h2>
          <p className="mt-2 text-xs text-white/40">These people can currently access your medical information.</p>
          
          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="py-8 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>
            ) : caregivers.length === 0 ? (
              <p className="text-sm text-white/20 italic">No caregivers authorized yet.</p>
            ) : (
              caregivers.map((cg) => (
                <div key={cg.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                      {cg.caregiver?.name?.[0]?.toUpperCase() || "C"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{cg.caregiver?.name}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-tighter">{cg.scope.replace("_", " ")}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(cg.caregiverId)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Patients I Care For */}
        <section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold text-white">Patients Under My Care</h2>
          <p className="mt-2 text-xs text-white/40">You have been granted access to the medical records of the following individuals.</p>
          
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full py-8 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>
            ) : patients.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-white/20 italic">No patients found. Share your User ID ({user?.id}) with family members to get access.</p>
              </div>
            ) : (
              patients.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition hover:border-cyan-500/30">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold text-lg">
                      {p.patient?.name?.[0]?.toUpperCase() || "P"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{p.patient?.name}</p>
                      <p className="text-xs text-white/50">{p.patient?.email}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {p.patient ? "Active Access" : "Access Granted"}
                    </span>
                    <button className="text-xs font-bold text-cyan-400 hover:underline">View Records</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
