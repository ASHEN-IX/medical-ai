import type { GatewayModelResult } from "@/services/api";
import { formatModelName } from "@/utils/formatters";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import RiskCard from "@/components/RiskCard";

interface ModelResultCardProps {
  modelName: string;
  result?: GatewayModelResult;
  detail?: any;
}

export default function ModelResultCard({ modelName, result, detail }: ModelResultCardProps) {
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

  const raw = detail?.raw_response || (result as any)?.raw_response;
  const probFromRaw = raw?.prediction?.autism_probability;
  const displayConfidence = typeof probFromRaw === "number" ? probFromRaw : result.confidence;
  const isAutismModel = modelName.includes("autism");

  const authoritativeDetection = raw?.prediction?.autism_detected ?? detail?.autism_detected;
  const detected = typeof authoritativeDetection === "boolean"
    ? authoritativeDetection
    : (typeof displayConfidence === "number" ? displayConfidence >= 0.5 : false);
    
  const displayLabel = isAutismModel ? (detected ? "ASD" : "No ASD") : result.risk;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <RiskCard
        label={normalizedName}
        value={displayLabel}
        risk={result.risk}
        helperText="Model-level medical risk estimation"
      />
      <div className="mt-4">
        <ConfidenceMeter confidence={displayConfidence} />
      </div>
    </div>
  );
}
