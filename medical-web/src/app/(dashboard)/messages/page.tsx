"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchInbox, fetchConversation, sendMessage } from "@/services/api";

type InboxEntry = {
  senderId: string;
  senderName: string;
  senderRole: string;
  unreadCount: number;
  lastMessage: { id: string; content: string; createdAt: string; read: boolean };
};

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender: { id: string; name: string; role: string };
};

function roleBadgeClasses(role: string): string {
  switch (role.toUpperCase()) {
    case "DOCTOR":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
    case "ADMIN":
      return "border-amber-400/30 bg-amber-500/15 text-amber-300";
    default:
      return "border-cyan-400/30 bg-cyan-500/15 text-cyan-300";
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeContact = inbox.find((e) => e.senderId === activeContactId) ?? null;

  const loadInbox = useCallback(async () => {
    try {
      const data = (await fetchInbox()) as InboxEntry[];
      setInbox(data);
    } catch {
      /* silent */
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  const loadConversation = useCallback(async (contactId: string) => {
    setLoadingConvo(true);
    try {
      const data = (await fetchConversation(contactId)) as Message[];
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingConvo(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!activeContactId) {
      setMessages([]);
      return;
    }
    void loadConversation(activeContactId);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void loadConversation(activeContactId);
      void loadInbox();
    }, 10_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeContactId, loadConversation, loadInbox]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !activeContactId || sending) return;

    setSending(true);
    try {
      await sendMessage({ receiverId: activeContactId, content: trimmed });
      setDraft("");
      await loadConversation(activeContactId);
      await loadInbox();
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const selectContact = (id: string) => {
    setActiveContactId(id);
    setDraft("");
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] gap-6">
      {/* ---- Left sidebar: Inbox ---- */}
      <aside className="flex w-[340px] shrink-0 flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">Messages</h2>
          <p className="mt-1 text-sm text-white/50">
            {loadingInbox ? "Loading..." : `${inbox.length} conversation${inbox.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!loadingInbox && inbox.length === 0 && (
            <div className="flex h-full items-center justify-center px-4">
              <p className="text-center text-sm text-white/40">No conversations yet</p>
            </div>
          )}

          <div className="space-y-1.5">
            {inbox.map((entry) => {
              const isActive = entry.senderId === activeContactId;
              return (
                <button
                  key={entry.senderId}
                  type="button"
                  onClick={() => selectContact(entry.senderId)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    isActive
                      ? "border-cyan-400/30 bg-cyan-500/10 shadow-lg shadow-cyan-500/5"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-white">{entry.senderName}</span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleBadgeClasses(entry.senderRole)}`}
                        >
                          {entry.senderRole}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-white/50">
                        {entry.lastMessage.content}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[11px] text-white/40">
                        {formatTime(entry.lastMessage.createdAt)}
                      </span>
                      {entry.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1.5 text-[10px] font-bold text-white">
                          {entry.unreadCount > 99 ? "99+" : entry.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ---- Right main area: Conversation ---- */}
      <section className="flex min-w-0 flex-1 flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        {!activeContactId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <svg className="h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white/40">Select a conversation</p>
              <p className="mt-1 text-sm text-white/25">Choose a contact from the sidebar to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
                {(activeContact?.senderName ?? "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{activeContact?.senderName ?? "Unknown"}</p>
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleBadgeClasses(activeContact?.senderRole ?? "")}`}
                >
                  {activeContact?.senderRole ?? ""}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingConvo && messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    <span className="text-sm text-white/40">Loading messages...</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "rounded-br-md border border-cyan-400/20 bg-cyan-500/15 text-white"
                            : "rounded-bl-md border border-white/10 bg-white/5 text-white/90"
                        }`}
                      >
                        {!isMine && (
                          <p className="mb-1 text-xs font-medium text-white/50">
                            {msg.sender.name}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        <p
                          className={`mt-1.5 text-[10px] ${
                            isMine ? "text-cyan-300/50" : "text-white/30"
                          }`}
                        >
                          {formatTimestamp(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-white/10 px-6 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || sending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/20 text-cyan-300 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
