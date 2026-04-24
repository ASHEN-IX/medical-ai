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

import {
  analyzeReport,
  fetchHistory,
  getReportById,
  saveAnalysisToHistory,
  type AnalysisHistoryItem,
  type AnalyzeReportPayload,
} from "@/services/api";

interface AIAnalysisContextValue {
  currentAnalysis: AnalysisHistoryItem | null;
  history: AnalysisHistoryItem[];
  loading: boolean;
  error: string | null;
  analyze: (payload: AnalyzeReportPayload) => Promise<AnalysisHistoryItem>;
  refreshHistory: () => Promise<void>;
  openHistoryItem: (id: string) => Promise<AnalysisHistoryItem | null>;
  clearError: () => void;
  setCurrentAnalysis: (item: AnalysisHistoryItem | null) => void;
}

const AIAnalysisContext = createContext<AIAnalysisContextValue | undefined>(undefined);

export function AIAnalysisProvider({ children }: { children: ReactNode }) {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisHistoryItem | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshHistory = useCallback(async () => {
    const historyData = await fetchHistory();
    setHistory(historyData);

    if (!currentAnalysis && historyData.length > 0) {
      setCurrentAnalysis(historyData[0]);
    }
  }, [currentAnalysis]);

  const analyze = useCallback(async (payload: AnalyzeReportPayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await analyzeReport(payload);
      const historyEntry = await saveAnalysisToHistory(payload, response);

      setCurrentAnalysis(historyEntry);
      setHistory((previous) => [historyEntry, ...previous].slice(0, 100));

      return historyEntry;
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "AI analysis failed.";
      setError(message);
      throw analysisError;
    } finally {
      setLoading(false);
    }
  }, []);

  const openHistoryItem = useCallback(async (id: string) => {
    const item = await getReportById(id);
    if (item) {
      setCurrentAnalysis(item);
    }
    return item;
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const contextValue = useMemo<AIAnalysisContextValue>(
    () => ({
      currentAnalysis,
      history,
      loading,
      error,
      analyze,
      refreshHistory,
      openHistoryItem,
      clearError,
      setCurrentAnalysis,
    }),
    [analyze, clearError, currentAnalysis, error, history, loading, openHistoryItem, refreshHistory]
  );

  return createElement(AIAnalysisContext.Provider, { value: contextValue }, children);
}

export function useAIAnalysis(): AIAnalysisContextValue {
  const context = useContext(AIAnalysisContext);
  if (!context) {
    throw new Error("useAIAnalysis must be used inside AIAnalysisProvider");
  }

  return context;
}
