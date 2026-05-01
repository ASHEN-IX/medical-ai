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
      <div className="flex h-full items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">No Analysis Loaded</h2>
          <p className="mb-6 text-sm text-slate-400">
            Upload and analyze a medical report first to start chatting with the AI assistant about your results.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Upload a Report
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-950">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-slate-800 px-6 py-4">
          <h1 className="text-lg font-semibold text-white">AI Health Assistant</h1>
          <p className="text-xs text-slate-400">Ask questions about your analysis results</p>
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
        <div className="border-t border-slate-800 px-6 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health data..."
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Analysis Context */}
      <div className="hidden w-72 flex-shrink-0 border-l border-slate-800 p-5 lg:block">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Analysis Context
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
