import type { PriorityLevel, RiskLevel } from "@/services/api";

export function formatModelName(modelName: string): string {
  const normalized = modelName.replace(/_/g, " ").trim();
  if (!normalized) {
    return "Unknown Model";
  }

  return normalized
    .split(" ")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`)
    .join(" ");
}

export function formatDateTime(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function formatConfidence(confidence: number): string {
  const safeValue = Number.isFinite(confidence) ? confidence : 0;
  return `${Math.round(Math.max(0, Math.min(1, safeValue)) * 100)}%`;
}

export function riskColorClass(risk: RiskLevel | "NEUTRAL"): string {
  if (risk === "HIGH") {
    return "text-red-700 bg-red-50 border-red-200";
  }

  if (risk === "MEDIUM") {
    return "text-orange-700 bg-orange-50 border-orange-200";
  }

  if (risk === "LOW") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }

  return "text-slate-700 bg-slate-50 border-slate-200";
}

export function riskProgressValue(risk: RiskLevel): number {
  if (risk === "HIGH") {
    return 0.92;
  }

  if (risk === "MEDIUM") {
    return 0.64;
  }

  return 0.28;
}

export function priorityBadgeClass(priority: PriorityLevel): string {
  if (priority === "URGENT") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (priority === "MEDIUM") {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}
