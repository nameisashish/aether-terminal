// ==========================================
// AI Chat Panel — Unified Interface
// Single panel for AI chat with:
// - Direct tool-calling (read/write/run)
// - Smart delegation to 8-agent team
// - Inline agent progress display
// - Inline approval UI
// - File context from explorer
// - Workspace-aware prompts
// ==========================================

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Trash2,
  Bot,
  User,
  Loader2,
  Sparkles,
  Users,
  FileCode,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAiStore } from "../../stores/aiStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useFileStore } from "../../stores/fileStore";
import { PROVIDER_INFO } from "../../lib/llm/types";
import { AGENTS } from "../../lib/agents/types";
import { Markdown } from "./Markdown";

/** Quick-start prompt suggestions */
const QUICK_PROMPTS = [
  { label: "📂 Analyze project", prompt: "Explore my project structure and tell me what this codebase does" },
  { label: "🐛 Find bugs", prompt: "Search my code for potential bugs, security issues, or anti-patterns" },
  { label: "🧪 Write tests", prompt: "Write comprehensive tests for my project" },
  { label: "📝 Add docs", prompt: "Generate documentation for this project" },
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
    toolActivity,
    agentSteps,
    pendingApprovals,
    resolveApproval,
  } = useAiStore();

  const { workspacePath } = useWorkspaceStore();
  const { selectedFiles } = useFileStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity, agentSteps, pendingApprovals]);

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

  // Build file context string from selected files
  const buildFileContext = useCallback(async (): Promise<string> => {
    if (selectedFiles.size === 0) return "";
    const contexts: string[] = [];
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      for (const filePath of selectedFiles) {
        try {
          const content = await readTextFile(filePath);
          const relativePath = workspacePath
            ? filePath.replace(workspacePath + "/", "")
            : filePath;
          contexts.push(`--- ${relativePath} ---\n${content.slice(0, 4000)}`);
        } catch {
          contexts.push(`--- ${filePath} --- (could not read)`);
        }
      }
    } catch {
      // fs plugin not available
    }
    return contexts.join("\n\n");
  }, [selectedFiles, workspacePath]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");

    const fileContext = await buildFileContext();
    await sendMessage(trimmed, workspacePath, fileContext);
  }, [input, isStreaming, workspacePath, buildFileContext, sendMessage]);

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
        animate={{ width: 380, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
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
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Aether AI
            </span>
            {isStreaming && (
              <Loader2 size={12} style={{ color: "var(--accent)" }} className="animate-spin" />
            )}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              className="icon-btn"
              onClick={clearMessages}
              title="Clear chat"
              style={{ width: "28px", height: "28px" }}
            >
              <Trash2 size={13} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setChatPanelOpen(false)}
              style={{ width: "28px", height: "28px" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Workspace context bar */}
        {workspacePath && (
          <div
            style={{
              padding: "4px 14px",
              fontSize: "10px",
              color: "var(--text-muted)",
              background: "rgba(124, 92, 252, 0.04)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            <FileCode size={10} style={{ color: "var(--accent)" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {workspacePath.split("/").pop()} — AI + Agent Team
            </span>
            {selectedFiles.size > 0 && (
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                · {selectedFiles.size} files selected
              </span>
            )}
          </div>
        )}

        {/* API key warning */}
        {!hasApiKey && (
          <div
            style={{
              margin: "8px 14px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(248, 113, 113, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.2)",
              fontSize: "12px",
              color: "var(--red)",
            }}
          >
            No API key for {providerInfo.name}. Go to Settings → API Keys.
          </div>
        )}

        {/* Messages */}
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
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "16px",
                padding: "20px",
              }}
            >
              <Sparkles size={28} strokeWidth={1.5} style={{ opacity: 0.3, color: "var(--accent)" }} />
              <span style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
                Ask me anything about your code
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, textAlign: "center" }}>
                I can read files, write code, run commands, and delegate to specialist agents
              </span>

              {/* Quick prompts */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  width: "100%",
                  maxWidth: "300px",
                }}
              >
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => {
                      setInput(qp.prompt);
                      inputRef.current?.focus();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textAlign: "left",
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
                }}
              >
                {msg.role === "user" ? (
                  <User size={12} style={{ color: "var(--text-secondary)" }} />
                ) : (
                  <Bot size={12} style={{ color: "var(--accent)" }} />
                )}
              </div>

              {/* Message content */}
              <div
                style={{
                  flex: 1,
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: "var(--text-primary)",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-sans)",
                  overflow: "hidden",
                }}
              >
                {msg.role === "assistant" ? (
                  <Markdown content={msg.content} />
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                )}
                {msg.isStreaming && (
                  <span
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "14px",
                      background: "var(--accent)",
                      borderRadius: "1px",
                      marginLeft: "2px",
                      animation: "blink 1s infinite",
                    }}
                  />
                )}
                {/* Provider badge */}
                {msg.role === "assistant" && msg.provider && !msg.isStreaming && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{ color: PROVIDER_INFO[msg.provider]?.color || "var(--text-muted)" }}>
                      {PROVIDER_INFO[msg.provider]?.name || msg.provider}
                    </span>
                    <span>·</span>
                    <span>{msg.model}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Tool Activity Feed — shows what AI is doing in real-time */}
          {isStreaming && toolActivity.length > 0 && (
            <div
              style={{
                margin: "4px 0",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "rgba(124, 92, 252, 0.04)",
                border: "1px solid rgba(124, 92, 252, 0.1)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "var(--accent)",
                  marginBottom: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Loader2 size={10} className="animate-spin" />
                AI is working...
              </div>
              {toolActivity.slice(-5).map((activity, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                    padding: "1px 0",
                    opacity: idx === toolActivity.slice(-5).length - 1 ? 1 : 0.6,
                  }}
                >
                  {activity}
                </div>
              ))}
            </div>
          )}

          {/* Inline Agent Team Activity */}
          {agentSteps.length > 0 && (
            <div
              style={{
                margin: "4px 0",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(124, 92, 252, 0.06)",
                border: "1px solid rgba(124, 92, 252, 0.15)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--accent)",
                  marginBottom: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Users size={12} />
                Agent Team Activity
              </div>
              {agentSteps.slice(-10).map((step) => (
                <div
                  key={step.id}
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    padding: "2px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "12px", flexShrink: 0 }}>
                    {AGENTS[step.agentRole]?.icon || "🔧"}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.action}
                  </span>
                  {(step.status === "working" || step.status === "thinking") && (
                    <Loader2
                      size={10}
                      className="animate-spin"
                      style={{ color: "var(--accent)", flexShrink: 0 }}
                    />
                  )}
                  {step.status === "done" && (
                    <CheckCircle size={10} style={{ color: "var(--green)", flexShrink: 0 }} />
                  )}
                  {step.status === "error" && (
                    <XCircle size={10} style={{ color: "var(--red)", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending Approvals — inline approve/reject UI */}
          {pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              style={{
                margin: "4px 0",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(251, 191, 36, 0.06)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#fbbf24",
                  marginBottom: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "12px" }}>
                  {AGENTS[approval.agentRole]?.icon || "⚠️"}
                </span>
                Approval Required — {AGENTS[approval.agentRole]?.name || "Agent"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  marginBottom: "4px",
                }}
              >
                {approval.action}
              </div>
              <pre
                style={{
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-tertiary)",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  maxHeight: "120px",
                  overflow: "auto",
                  margin: "4px 0 8px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {approval.detail.slice(0, 500)}
                {approval.detail.length > 500 && "..."}
              </pre>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => resolveApproval(approval.id, "approve")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "var(--green, #4ade80)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <CheckCircle size={11} />
                  Approve
                </button>
                <button
                  onClick={() => resolveApproval(approval.id, "reject")}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--red, #f87171)",
                    background: "transparent",
                    color: "var(--red, #f87171)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <XCircle size={11} />
                  Reject
                </button>
              </div>
            </div>
          ))}

          {/* Error display */}
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(248, 113, 113, 0.08)",
                border: "1px solid rgba(248, 113, 113, 0.2)",
                fontSize: "12px",
                color: "var(--red)",
                cursor: "pointer",
              }}
              onClick={clearError}
            >
              {error}
              <span style={{ opacity: 0.5, marginLeft: "8px" }}>click to dismiss</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: "4px", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your code, or describe a task..."
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
                maxHeight: "80px",
                lineHeight: "1.5",
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 80) + "px";
              }}
              onFocus={(e) => {
                (e.target as HTMLElement).style.borderColor = "var(--accent)";
              }}
              onBlur={(e) => {
                (e.target as HTMLElement).style.borderColor = "var(--border-subtle)";
              }}
            />
            <button
              className="btn btn-primary"
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "4px",
              fontSize: "10px",
              color: "var(--text-muted)",
            }}
          >
            <span>Shift+Enter for newline</span>
            <span>⚡ AI + Agent Team</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
