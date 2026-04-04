// ==========================================
// Settings Panel Component
// Modal settings panel with API key management,
// model selection, and theme options.
// ==========================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings } from "lucide-react";
import { ApiKeyManager } from "./ApiKeyManager";
import { useAiStore } from "../../stores/aiStore";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { config, setConfig } = useAiStore();
  const [activeSection, setActiveSection] = useState<"keys" | "model" | "general">("keys");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            width: "560px",
            maxHeight: "80vh",
            background: "var(--bg-secondary)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} style={{ color: "var(--accent)" }} />
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Settings
              </span>
            </div>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: "2px",
              padding: "8px 16px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {[
              { key: "keys" as const, label: "API Keys" },
              { key: "model" as const, label: "Model" },
              { key: "general" as const, label: "General" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  border: "none",
                  background:
                    activeSection === tab.key
                      ? "var(--bg-hover)"
                      : "transparent",
                  color:
                    activeSection === tab.key
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
            }}
          >
            {activeSection === "keys" && <ApiKeyManager />}

            {activeSection === "model" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Temperature
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) =>
                        setConfig({ temperature: parseFloat(e.target.value) })
                      }
                      style={{ flex: 1 }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                        width: "32px",
                        textAlign: "right",
                      }}
                    >
                      {config.temperature}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={config.maxTokens}
                    onChange={(e) =>
                      setConfig({ maxTokens: parseInt(e.target.value) || 4096 })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      fontFamily: "var(--font-mono)",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="checkbox"
                    id="streaming"
                    checked={config.streaming}
                    onChange={(e) => setConfig({ streaming: e.target.checked })}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <label
                    htmlFor="streaming"
                    style={{
                      fontSize: "13px",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    Enable streaming responses
                  </label>
                </div>
              </div>
            )}

            {activeSection === "general" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    About
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      lineHeight: "1.6",
                    }}
                  >
                    <strong>Aether Terminal</strong> v0.1.0<br />
                    AI-native terminal with 8 specialized agents.<br />
                    Built with Tauri v2 · React 19 · xterm.js · LangChain.js
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    Keyboard Shortcuts
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr",
                      gap: "6px 16px",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>⌘ T</span>
                    <span>New terminal tab</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>⌘ W</span>
                    <span>Close current tab</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Enter</span>
                    <span>Approve agent action</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Escape</span>
                    <span>Reject agent action / close panel</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Shift+Enter</span>
                    <span>Newline in chat input</span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    Links
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      lineHeight: "2",
                    }}
                  >
                    <a href="https://github.com/nameisashish/aether-terminal" target="_blank" style={{ color: "var(--accent)" }}>GitHub Repository</a><br />
                    <a href="https://ollama.com" target="_blank" style={{ color: "var(--accent)" }}>Get Ollama (for local AI)</a><br />
                    <a href="https://console.groq.com" target="_blank" style={{ color: "var(--accent)" }}>Get Groq API Key (free tier)</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
