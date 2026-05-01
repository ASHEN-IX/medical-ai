"use client";

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  analyzeReport,
  fetchAnalyses,
  fetchAnalysisById,
  fetchHealthTimeline,
  saveAnalysisToHistory,
  type AnalysisHistoryItem,
  type AnalyzeReportPayload,
  type HealthTimeline,
} from "@/services/api";

interface AIAnalysisContextValue {
  currentAnalysis: AnalysisHistoryItem | null;
  history: AnalysisHistoryItem[];
  healthTimeline: HealthTimeline | null;
  loading: boolean;
  error: string | null;
  analyze: (payload: AnalyzeReportPayload) => Promise<AnalysisHistoryItem>;
  refreshHistory: () => Promise<void>;
  refreshTimeline: () => Promise<void>;
  openHistoryItem: (id: string) => Promise<AnalysisHistoryItem | null>;
  clearError: () => void;
  setCurrentAnalysis: (item: AnalysisHistoryItem | null) => void;
}

const AIAnalysisContext = createContext<AIAnalysisContextValue | undefined>(undefined);

export function AIAnalysisProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisHistoryItem | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [healthTimeline, setHealthTimeline] = useState<HealthTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshHistory = useCallback(async () => {
    const data = await fetchAnalyses();
    setHistory(data);
    if (data.length > 0 && !currentAnalysis) setCurrentAnalysis(data[0]);
  }, [currentAnalysis]);

  const refreshTimeline = useCallback(async () => {
    const data = await fetchHealthTimeline();
    setHealthTimeline(data);
  }, []);

  const analyze = useCallback(async (payload: AnalyzeReportPayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await analyzeReport(payload);
      const entry = await saveAnalysisToHistory(payload, response);
      setCurrentAnalysis(entry);

      await refreshHistory();
      await refreshTimeline();

      return entry;
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI analysis failed.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshHistory, refreshTimeline]);

  const openHistoryItem = useCallback(async (id: string) => {
    const item = await fetchAnalysisById(id);
    if (item) setCurrentAnalysis(item);
    return item;
  }, []);

  useEffect(() => {
    if (user?.id) {
      void refreshHistory();
      void refreshTimeline();
    }
  }, [user?.id, refreshHistory, refreshTimeline]);

  const contextValue = useMemo<AIAnalysisContextValue>(
    () => ({
      currentAnalysis,
      history,
      healthTimeline,
      loading,
      error,
      analyze,
      refreshHistory,
      refreshTimeline,
      openHistoryItem,
      clearError,
      setCurrentAnalysis,
    }),
    [analyze, clearError, currentAnalysis, error, healthTimeline, history, loading, openHistoryItem, refreshHistory, refreshTimeline]
  );

  return createElement(AIAnalysisContext.Provider, { value: contextValue }, children);
}

export function useAIAnalysis(): AIAnalysisContextValue {
  const context = useContext(AIAnalysisContext);
  if (!context) throw new Error("useAIAnalysis must be used inside AIAnalysisProvider");
  return context;
}
