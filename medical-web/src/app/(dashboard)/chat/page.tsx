"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAIAnalysis } from "@/hooks/useAIAnalysis";
import { chatWithAI, type ChatMessage } from "@/services/api";

const SUGGESTED_QUESTIONS = [
  "Is this dangerous?",
  "What should I do?",
  "Explain my results",
  "What does my risk level mean?",
];

interface DisplayMessage extends ChatMessage {
  sources?: string[];
}

export default function ChatPage() {
  const { currentAnalysis } = useAIAnalysis();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const buildContext = (): Record<string, unknown> | undefined => {
    if (!currentAnalysis) return undefined;
    return {
      healthScore: currentAnalysis.healthScore,
      riskLevel: currentAnalysis.riskLevel,
      keyFindings: currentAnalysis.keyFindings,
      aiInsights: currentAnalysis.aiInsights,
      results: currentAnalysis.results,
      testName: currentAnalysis.testName,
      features: currentAnalysis.features,
      symptoms: currentAnalysis.symptoms,
    };
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: DisplayMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const history: ChatMessage[] = messages.map(({ role, content }) => ({ role, content }));
      const { response, sources } = await chatWithAI(text.trim(), buildContext(), history);
      const assistantMessage: DisplayMessage = { role: "assistant", content: response, sources };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: DisplayMessage = {
        role: "assistant",
        content: "I'm sorry, I was unable to process your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  if (!currentAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[80vh] animate-in">
        <div className="glass-card p-12 max-w-xl text-center border-dashed border-white/10">
          <div className="relative mx-auto mb-8 h-24 w-24">
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full animate-pulse" />
            <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-slate-900 border border-white/10 text-cyan-400">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Intelligence Standby</h2>
          <p className="mt-4 text-slate-400 font-medium leading-relaxed">
            I am ready to analyze your clinical data, but I need context to provide accurate medical insights.
            Please upload a report or select an existing analysis to begin our session.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/diagnosis"
              className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-4 font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.05] transition-all active:scale-95"
            >
              Start New Analysis
            </Link>
            <Link
              href="/history"
              className="w-full sm:w-auto rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white hover:bg-white/10 transition-all"
            >
              View History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-in">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col glass-card border-y-0 border-l-0 rounded-none">
        {/* Header */}
        <div className="border-b border-white/5 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h1 className="text-xl font-black text-white uppercase tracking-tight">AI Health Assistant</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Diagnostic Context Active</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                <svg className="h-7 w-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-medium text-white">How can I help you?</h2>
              <p className="mb-8 max-w-sm text-center text-sm text-slate-400">
                Ask me anything about your medical analysis. I can help interpret results, explain risk factors, and suggest next steps.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void sendMessage(q)}
                    className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-600 hover:bg-slate-800 hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-600 pt-2">
                    <p className="mb-1 text-xs font-medium text-slate-400">Sources</p>
                    <ul className="space-y-0.5">
                      {msg.sources.map((src, i) => (
                        <li key={i} className="text-xs text-slate-500">{src}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="mb-4 flex justify-start">
              <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 border-t border-white/5">
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute inset-0 bg-cyan-500/5 blur-xl group-focus-within:bg-cyan-500/10 transition-all rounded-2xl" />
            <div className="relative flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Inquire about clinical findings, risks, or next steps..."
                disabled={loading}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Analysis Context */}
      <div className="hidden w-80 flex-shrink-0 p-8 lg:block border-l border-white/5 bg-white/[0.02]">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">
          Diagnostic Context
        </h3>

        <div className="space-y-4">
          {/* Health Score */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="mb-1 text-xs text-slate-400">Health Score</p>
            <p className="text-2xl font-bold text-white">
              {currentAnalysis.healthScore !== null ? currentAnalysis.healthScore : "--"}
              <span className="text-sm font-normal text-slate-500">/100</span>
            </p>
          </div>

          {/* Risk Level */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="mb-1 text-xs text-slate-400">Risk Level</p>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                currentAnalysis.riskLevel === "CRITICAL"
                  ? "bg-red-900/50 text-red-300"
                  : currentAnalysis.riskLevel === "HIGH"
                    ? "bg-orange-900/50 text-orange-300"
                    : currentAnalysis.riskLevel === "MEDIUM"
                      ? "bg-yellow-900/50 text-yellow-300"
                      : "bg-green-900/50 text-green-300"
              }`}
            >
              {currentAnalysis.riskLevel}
            </span>
          </div>

          {/* Test Name */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <p className="mb-1 text-xs text-slate-400">Report Type</p>
            <p className="text-sm font-medium capitalize text-white">{currentAnalysis.testName}</p>
          </div>

          {/* Key Findings */}
          {currentAnalysis.keyFindings.length > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-2 text-xs text-slate-400">Key Findings</p>
              <ul className="space-y-1.5">
                {currentAnalysis.keyFindings.slice(0, 4).map((f, i) => (
                  <li key={i} className="text-xs leading-snug text-slate-300">
                    {f}
                  </li>
                ))}
                {currentAnalysis.keyFindings.length > 4 && (
                  <li className="text-xs text-slate-500">
                    +{currentAnalysis.keyFindings.length - 4} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
