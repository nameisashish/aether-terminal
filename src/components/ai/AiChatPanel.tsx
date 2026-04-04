// ==========================================
// AI Chat Panel Component — Full Integration
// Side panel for AI chat with:
// - Full codebase access (reads/writes files)
// - Agent team toggle for complex tasks
// - File context from explorer selections
// - Workspace-aware prompts
// - Tool activity display
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
} from "lucide-react";
import { useAiStore } from "../../stores/aiStore";
import { useAgentStore } from "../../stores/agentStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useFileStore } from "../../stores/fileStore";
import { PROVIDER_INFO } from "../../lib/llm/types";
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
    useAgentMode,
    setUseAgentMode,
    toolActivity,
  } = useAiStore();

  const { startTask, setDashboardOpen } = useAgentStore();
  const { workspacePath } = useWorkspaceStore();
  const { selectedFiles } = useFileStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity]);

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

    if (useAgentMode) {
      // Route to agent system
      setDashboardOpen(true);
      startTask(trimmed);
    } else {
      // Route to AI chat with tools
      const fileContext = await buildFileContext();
      await sendMessage(trimmed, workspacePath, fileContext);
    }
  }, [input, isStreaming, useAgentMode, workspacePath, buildFileContext, sendMessage, startTask, setDashboardOpen]);

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

        {/* Mode toggle bar */}
        <div
          style={{
            display: "flex",
            gap: "2px",
            padding: "6px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setUseAgentMode(false)}
            style={{
              flex: 1,
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              background: !useAgentMode ? "var(--accent-muted)" : "transparent",
              color: !useAgentMode ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            <Sparkles size={11} />
            AI Chat
          </button>
          <button
            onClick={() => setUseAgentMode(true)}
            style={{
              flex: 1,
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              background: useAgentMode ? "var(--accent-muted)" : "transparent",
              color: useAgentMode ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            <Users size={11} />
            Agent Team
          </button>
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
              {workspacePath.split("/").pop()} — AI has codebase access
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
                {useAgentMode
                  ? "Describe a task for the 8-agent team"
                  : "Ask me anything about your code"}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, textAlign: "center" }}>
                {useAgentMode
                  ? "Agents will read your code, make changes, and ask for approval"
                  : "I can read files, write code, and run commands in your project"}
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

          {/* Tool Activity Feed - shows what AI is doing in real-time */}
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
              placeholder={
                useAgentMode
                  ? "Describe a task for the agents..."
                  : "Ask about your code..."
              }
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
            <span>
              {useAgentMode ? "🤖 Agent mode" : "💬 AI + Tools"}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
