import type { GatewayModelResult } from "@/services/api";
import { formatModelName } from "@/utils/formatters";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import RiskCard from "@/components/RiskCard";

interface ModelResultCardProps {
  modelName: string;
  result?: GatewayModelResult;
}

export default function ModelResultCard({ modelName, result }: ModelResultCardProps) {
  const normalizedName = formatModelName(modelName);

  if (!result) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <RiskCard
          label={normalizedName}
          value="Not Triggered"
          risk="NEUTRAL"
          helperText="This model was not selected for the current feature set."
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <RiskCard
        label={normalizedName}
        value={result.risk}
        risk={result.risk}
        helperText="Model-level medical risk estimation"
      />
      <div className="mt-4">
        <ConfidenceMeter confidence={result.confidence} />
      </div>
    </div>
  );
}
