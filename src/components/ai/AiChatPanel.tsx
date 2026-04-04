// ==========================================
// AI Chat Panel Component — Dual-audience UX
// Side panel for AI chat with:
// - Beginner-friendly onboarding prompts
// - Power-user keyboard shortcuts
// - Streaming responses with provider badges
// ==========================================

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Trash2,
  Bot,
  User,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAiStore } from "../../stores/aiStore";
import { PROVIDER_INFO } from "../../lib/llm/types";

/** Quick-start prompt suggestions for beginners */
const QUICK_PROMPTS = [
  { label: "Explain my code", prompt: "Explain what this code does and suggest improvements" },
  { label: "Debug an error", prompt: "Help me debug this error: " },
  { label: "Write a test", prompt: "Write unit tests for " },
  { label: "Optimize perf", prompt: "How can I optimize the performance of " },
];

export function AiChatPanel() {
  const {
    chatPanelOpen,
    setChatPanelOpen,
    messages,
    isStreaming,
    error,
    config,
    sendMessage,
    clearMessages,
    clearError,
    apiKeys,
  } = useAiStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatPanelOpen]);

  // Keyboard shortcut: Escape to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && chatPanelOpen) {
        setChatPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatPanelOpen, setChatPanelOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasApiKey = config.provider === "local" || !!apiKeys[config.provider];
  const providerInfo = PROVIDER_INFO[config.provider];

  if (!chatPanelOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 420, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Aether AI
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "4px",
                background: providerInfo.color + "20",
                color: providerInfo.color,
                fontWeight: 500,
              }}
            >
              {providerInfo.name}
            </span>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              className="icon-btn"
              onClick={clearMessages}
              title="Clear chat (⌘ K)"
              style={{ width: "28px", height: "28px" }}
            >
              <Trash2 size={14} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setChatPanelOpen(false)}
              title="Close (Esc)"
              style={{ width: "28px", height: "28px" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Messages List ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Onboarding — shown when no messages yet */}
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "16px",
                color: "var(--text-muted)",
              }}
            >
              <Bot size={32} strokeWidth={1.5} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
                Ask Aether anything
              </span>
              <span style={{ fontSize: "11px", opacity: 0.6 }}>
                {providerInfo.name} · {config.model}
              </span>

              {/* Quick prompts for beginners */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  justifyContent: "center",
                  marginTop: "8px",
                  maxWidth: "320px",
                }}
              >
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => setInput(qp.prompt)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* Keyboard shortcut hint */}
              <div style={{ fontSize: "10px", opacity: 0.4, marginTop: "12px" }}>
                Enter to send · Shift+Enter for newline · Esc to close
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background:
                    msg.role === "user"
                      ? "var(--bg-hover)"
                      : "var(--accent-muted)",
                  color:
                    msg.role === "user"
                      ? "var(--text-secondary)"
                      : "var(--accent)",
                }}
              >
                {msg.role === "user" ? (
                  <User size={13} />
                ) : (
                  <Bot size={13} />
                )}
              </div>

              {/* Message body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "var(--text-primary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "14px",
                        background: "var(--accent)",
                        marginLeft: "2px",
                        animation: "blink 1s infinite",
                        verticalAlign: "text-bottom",
                      }}
                    />
                  )}
                </div>
                {msg.role === "assistant" && !msg.isStreaming && msg.model && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                    }}
                  >
                    {msg.model}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(248, 113, 113, 0.1)",
              borderTop: "1px solid rgba(248, 113, 113, 0.2)",
              fontSize: "12px",
              color: "var(--red)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <button
              onClick={clearError}
              style={{
                background: "none",
                border: "none",
                color: "var(--red)",
                cursor: "pointer",
                padding: "2px",
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Input Area ── */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          {!hasApiKey ? (
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "8px",
                lineHeight: "1.5",
              }}
            >
              Add your {providerInfo.name} API key in{" "}
              <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                Settings → API Keys
              </span>{" "}
              to start chatting.
              <br />
              <span style={{ fontSize: "10px", opacity: 0.6 }}>
                Keys are stored locally and never leave your device.
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-end",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Aether..."
                disabled={isStreaming}
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  maxHeight: "120px",
                  lineHeight: "1.5",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 120) + "px";
                }}
                onFocus={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--border-subtle)";
                }}
              />
              <button
                className="btn-primary btn"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  opacity: !input.trim() || isStreaming ? 0.5 : 1,
                }}
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
