import axios from "axios";

export type ReportType = "auto" | "diabetes" | "heart" | "kidney" | "stroke" | "mixed";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type PriorityLevel = "LOW" | "MEDIUM" | "URGENT";

export interface AnalyzeReportPayload {
  report_type: ReportType;
  features: Record<string, number>;
  include_explanation?: boolean;
  symptoms?: string[];
  image?: string;
}

export interface GatewayModelResult {
  risk: RiskLevel;
  confidence: number;
}

export interface GatewayModelDetail extends GatewayModelResult {
  source?: string;
  success?: boolean;
  error?: string | null;
  raw_response?: Record<string, unknown> | null;
}

export interface RiskAssessment {
  overall_risk: RiskLevel;
  priority: PriorityLevel;
  final_decision: string;
  rationale: string[];
}

export interface KnowledgeGraphInsights {
  diseases: string[];
  symptoms: string[];
  risk_factors: string[];
  complications: string[];
  treatments: string[];
  connections: string[];
}

export interface GatewayAnalyzeResponse {
  success: boolean;
  request_id: string;
  inputs: {
    report_type: ReportType;
    include_explanation: boolean;
    symptoms: string[];
    has_image: boolean;
    has_raw_text: boolean;
  };
  extracted_features: Record<string, unknown>;
  model_outputs: Record<string, GatewayModelDetail>;
  rag_context: string[];
  kg_insights: KnowledgeGraphInsights;
  risk_assessment: RiskAssessment;
  llm_explanation_text: string;
  final_decision: string;
  selected_models: string[];
  results: Record<string, GatewayModelResult>;
  final_assessment: {
    overall_risk: RiskLevel;
    priority: PriorityLevel;
  };
  reasoning: string[];
  llm_explanation?: {
    summary: string;
    explanation: string[];
    risk_interpretation: { level: RiskLevel; meaning: string };
    recommendations: string[];
    safety_note: string;
  } | null;
  metadata: {
    processing_time_ms: number;
    timestamp: string;
  };
}

export interface AnalysisHistoryItem {
  id: string;
  createdAt: string;
  request: AnalyzeReportPayload;
  response: GatewayAnalyzeResponse;
}

const HISTORY_STORAGE_KEY = "medai-nexus-analysis-history-v1";

const aiGatewayApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AI_GATEWAY_URL || "http://localhost:8000",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

function normalizeError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const timeout = error.code === "ECONNABORTED";
    if (timeout) {
      return new Error("The AI service took too long to respond. Please try again.");
    }

    const status = error.response?.status;
    const detailPayload = error.response?.data as
      | { detail?: { message?: string; details?: string } | string; message?: string }
      | undefined;

    const detailMessage =
      (typeof detailPayload?.detail === "string" && detailPayload.detail) ||
      (typeof detailPayload?.detail === "object" &&
        (detailPayload.detail.details || detailPayload.detail.message)) ||
      detailPayload?.message;

    if (status === 400) {
      return new Error(detailMessage || "Invalid input. Please review your values and try again.");
    }

    if (status === 422) {
      return new Error(detailMessage || "The request could not be processed. Please check your data.");
    }

    if (status && status >= 500) {
      return new Error("AI service is temporarily unavailable. Please try again in a moment.");
    }

    return new Error(detailMessage || "Failed to complete AI analysis request.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unexpected API error.");
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function generateHistoryId(): string {
  if (isBrowser() && "crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `analysis_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function readHistoryFromStorage(): AnalysisHistoryItem[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const payload = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!payload) {
      return [];
    }

    const parsed = JSON.parse(payload) as AnalysisHistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

function writeHistoryToStorage(history: AnalysisHistoryItem[]): void {
  if (!isBrowser()) {
    return;
  }

  const capped = history.slice(0, 100);
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
}

export async function analyzeReport(payload: AnalyzeReportPayload): Promise<GatewayAnalyzeResponse> {
  try {
    const { data } = await aiGatewayApi.post<GatewayAnalyzeResponse>("/api/v1/ai/analyze", payload);
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function fetchHistory(): Promise<AnalysisHistoryItem[]> {
  return readHistoryFromStorage();
}

export async function getReportById(id: string): Promise<AnalysisHistoryItem | null> {
  const history = readHistoryFromStorage();
  return history.find((item) => item.id === id) || null;
}

export async function saveAnalysisToHistory(
  request: AnalyzeReportPayload,
  response: GatewayAnalyzeResponse
): Promise<AnalysisHistoryItem> {
  const history = readHistoryFromStorage();

  const entry: AnalysisHistoryItem = {
    id: generateHistoryId(),
    createdAt: new Date().toISOString(),
    request,
    response,
  };

  writeHistoryToStorage([entry, ...history]);
  return entry;
}
