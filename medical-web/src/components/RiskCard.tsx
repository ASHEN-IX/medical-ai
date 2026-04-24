import { riskColorClass } from "@/utils/formatters";
import type { RiskLevel } from "@/services/api";

interface RiskCardProps {
  label: string;
  value: string;
  risk?: RiskLevel | "NEUTRAL";
  helperText?: string;
  className?: string;
}

export default function RiskCard({
  label,
  value,
  risk = "NEUTRAL",
  helperText,
  className,
}: RiskCardProps) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition-all ${riskColorClass(risk)} ${className || ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight">{value}</p>
      {helperText ? <p className="mt-2 text-sm opacity-90">{helperText}</p> : null}
    </article>
  );
}
