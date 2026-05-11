"use client";

import { useState, useEffect } from "react";
import { fetchAlerts, fetchAlertUnreadCount, markAlertRead, dismissAlert, markAllAlertsRead } from "@/services/api";

const SEVERITY_STYLES: Record<string, string> = {
  INFO: "border-blue-500/30 bg-blue-500/10",
  WARNING: "border-amber-500/30 bg-amber-500/10",
  CRITICAL: "border-red-500/30 bg-red-500/10",
  EMERGENCY: "border-rose-500/40 bg-rose-500/20 animate-pulse",
};

const SEVERITY_ICON: Record<string, string> = {
  INFO: "ℹ️", WARNING: "⚠️", CRITICAL: "🚨", EMERGENCY: "🆘",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts(filter === "unread");
      setAlerts(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, [filter]);

  const handleMarkRead = async (id: string) => {
    await markAlertRead(id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  };

  const handleDismiss = async (id: string) => {
    await dismissAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Smart Alerts</h1>
          <p className="mt-1 text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter(filter === "all" ? "unread" : "all")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
          >
            {filter === "all" ? "Show Unread" : "Show All"}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-slate-400">
          <p className="text-4xl mb-2">✅</p>
          <p>No alerts to display</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 transition ${
                SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO
              } ${alert.read ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{SEVERITY_ICON[alert.severity] || "📋"}</span>
                  <div>
                    <h3 className="font-semibold text-white">{alert.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(alert.createdAt).toLocaleString()} · {alert.type.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!alert.read && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/20"
                    >
                      Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/20"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
