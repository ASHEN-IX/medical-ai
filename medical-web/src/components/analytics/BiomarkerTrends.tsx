"use client";

import React, { useEffect, useState } from "react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { fetchHealthTimeline, type HealthTimeline } from "@/services/api";

export default function BiomarkerTrends() {
  const [data, setData] = useState<HealthTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthTimeline()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data && !selectedMetric) {
      const keys = Object.keys(data.metrics);
      if (keys.length > 0) setSelectedMetric(keys[0]);
    }
  }, [data, selectedMetric]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!data || Object.keys(data.metrics).length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-sm font-medium text-white/40">Insufficient data for trends</p>
        <p className="max-w-xs text-xs text-white/20">Keep uploading reports to track your health progress over time.</p>
      </div>
    );
  }

  const metricData = selectedMetric ? data.metrics[selectedMetric] : [];
  const chartData = metricData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Biomarker Trends</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(data.metrics).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                selectedMetric === key
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                  : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60"
              }`}
            >
              {key.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number | string) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#fff",
                }}
                itemStyle={{ color: "#22d3ee" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorValue)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {data.insights.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {data.insights.slice(0, 2).map((insight, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                <div className="mt-1 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                <p className="text-xs leading-relaxed text-white/70">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
