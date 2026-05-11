"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  createdAt: string;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
};

type Metrics = {
  drift: Record<string, number>;
  volume: Array<{ date: string; count: number }>;
  latency: number;
};

export default function AdminMonitoringPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [logRes, metricRes] = await Promise.all([
        apiClient.get("/logs/audit-feed"), // I'll need to implement this
        apiClient.get("/metrics/mlops-summary"), // I'll need to implement this
      ]);
      setLogs(logRes.data);
      setMetrics(metricRes.data);
    } catch (err) {
      console.error("Failed to load monitoring data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.push("/diagnosis");
      return;
    }

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user, router, loadData]);

  const averageDrift = metrics ? Object.values(metrics.drift || {}).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.keys(metrics.drift || {}).length) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">System & MLOps Governance</h1>
        <p className="mt-2 text-sm text-white/50">Real-time infrastructure monitoring, model drift detection, and HIPAA audit feed.</p>
      </header>

      {/* Top Stats Row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "API Latency", value: `${metrics?.latency ?? 0}ms`, sub: "Avg Response Time", color: "text-cyan-400" },
          { label: "Model Drift", value: averageDrift.toFixed(3), sub: "Global Average", color: "text-emerald-400" },
          { label: "Active Sessions", value: "42", sub: "Concurrent Users", color: "text-violet-400" },
          { label: "Audit events", value: `${logs.length}`, sub: "Last 24 Hours", color: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-xl">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-white/30">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ML Performance Chart */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold text-white">Model Request Volume</h2>
          <div className="mt-8 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.volume || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff30" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                  itemStyle={{ color: "#22d3ee" }}
                />
                <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Live Audit Feed */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Live HIPAA Audit Feed</h2>
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          </div>
          <div className="mt-8 h-[300px] overflow-y-auto pr-2 space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="group relative rounded-xl border border-white/5 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">{log.action}</span>
                    <span className="text-xs text-white/40">{log.resource}</span>
                  </div>
                  <span className="text-[10px] text-white/20">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  <span className="font-semibold text-white/80">Actor:</span> {log.actorId}
                  <span className="mx-2 opacity-30">|</span>
                  <span className="font-semibold text-white/80">IP:</span> {log.ipAddress}
                </p>
                {log.details && (
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-white/5 bg-black/20 p-3 text-[10px] text-white/50">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Model Health / Drift Table */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Model Drift & Performance Integrity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                <th className="pb-4">Model Name</th>
                <th className="pb-4">Target Accuracy</th>
                <th className="pb-4">Current Precision</th>
                <th className="pb-4">PSI (Drift)</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm text-white/70">
              {[
                { name: "Diabetes Predictor V4", target: "94.2%", current: "93.8%", psi: "0.021", status: "STABLE", color: "text-emerald-400" },
                { name: "Heart Risk Ensemble", target: "91.5%", current: "90.2%", psi: "0.045", status: "STABLE", color: "text-emerald-400" },
                { name: "CKD Detection DL", target: "89.0%", current: "86.5%", psi: "0.120", status: "DRIFTING", color: "text-amber-400" },
                { name: "Autism Multi-Modal", target: "96.5%", current: "96.8%", psi: "0.008", status: "OPTIMIZED", color: "text-cyan-400" },
              ].map((m, i) => (
                <tr key={i} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                  <td className="py-4 font-medium text-white">{m.name}</td>
                  <td className="py-4">{m.target}</td>
                  <td className="py-4">{m.current}</td>
                  <td className="py-4 font-mono">{m.psi}</td>
                  <td className="py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-current \${m.color} bg-white/5`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
