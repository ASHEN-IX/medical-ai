import { formatConfidence } from "@/utils/formatters";

interface ConfidenceMeterProps {
  confidence: number;
  label?: string;
}

export default function ConfidenceMeter({ confidence, label = "Confidence" }: ConfidenceMeterProps) {
  const safeValue = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  const width = `${Math.round(safeValue * 100)}%`;

  const toneClass =
    safeValue >= 0.75
      ? "from-red-500 to-rose-500"
      : safeValue >= 0.5
      ? "from-orange-500 to-amber-500"
      : "from-emerald-500 to-teal-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{formatConfidence(safeValue)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneClass} transition-all duration-500 ease-out`}
          style={{ width }}
          aria-label={`${label} meter`}
          role="progressbar"
          aria-valuenow={Math.round(safeValue * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
