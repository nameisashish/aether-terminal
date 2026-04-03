// ==========================================
// API Key Manager Component
// Settings UI for managing API keys for all
// supported LLM providers.
// ==========================================

import { useState } from "react";
import { Eye, EyeOff, Check, X, Key, Trash2 } from "lucide-react";
import { useAiStore } from "../../stores/aiStore";
import type { LLMProvider } from "../../lib/llm/types";
import { PROVIDER_INFO, PROVIDER_MODELS } from "../../lib/llm/types";

const PROVIDERS: LLMProvider[] = ["groq", "openai", "anthropic", "gemini", "xai"];

export function ApiKeyManager() {
  const { apiKeys, setApiKey, removeApiKey, config, setConfig } = useAiStore();
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const handleSave = (provider: LLMProvider) => {
    if (inputValue.trim()) {
      setApiKey(provider, inputValue.trim());
    }
    setEditingProvider(null);
    setInputValue("");
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setInputValue("");
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Key size={16} style={{ color: "var(--accent)" }} />
        API Keys
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          lineHeight: "1.5",
        }}
      >
        Keys are stored securely on your device and never sent to any server
        except the respective LLM API.
      </div>

      {PROVIDERS.map((provider) => {
        const info = PROVIDER_INFO[provider];
        const hasKey = !!apiKeys[provider];
        const isEditing = editingProvider === provider;
        const isActive = config.provider === provider;

        return (
          <div
            key={provider}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: `1px solid ${isActive ? info.color + "40" : "var(--border-subtle)"}`,
              background: isActive ? info.color + "08" : "var(--bg-tertiary)",
            }}
          >
            {/* Provider header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: isEditing ? "10px" : hasKey ? "8px" : "0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: info.color,
                  }}
                >
                  {info.name}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "var(--accent-muted)",
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "4px" }}>
                {hasKey && !isEditing && (
                  <>
                    <button
                      className="icon-btn"
                      onClick={() => setConfig({ provider })}
                      title={`Use ${info.name}`}
                      style={{
                        width: "24px",
                        height: "24px",
                        color: isActive ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => removeApiKey(provider)}
                      title="Remove key"
                      style={{ width: "24px", height: "24px" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                {!isEditing && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingProvider(provider);
                      setInputValue(apiKeys[provider] || "");
                    }}
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    {hasKey ? "Edit" : "Add Key"}
                  </button>
                )}
              </div>
            </div>

            {/* Key display */}
            {hasKey && !isEditing && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                }}
              >
                <span>
                  {visibleKeys[provider]
                    ? apiKeys[provider]
                    : maskKey(apiKeys[provider]!)}
                </span>
                <button
                  className="icon-btn"
                  onClick={() => toggleVisibility(provider)}
                  style={{ width: "20px", height: "20px" }}
                >
                  {visibleKeys[provider] ? (
                    <EyeOff size={11} />
                  ) : (
                    <Eye size={11} />
                  )}
                </button>
              </div>
            )}

            {/* Edit mode */}
            {isEditing && (
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="password"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Enter ${info.name} API key...`}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave(provider);
                    if (e.key === "Escape") handleCancel();
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSave(provider)}
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                >
                  <Check size={14} />
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleCancel}
                  style={{ padding: "4px 8px" }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Model selector */}
      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Model
        </div>
        <select
          value={config.model}
          onChange={(e) => setConfig({ model: e.target.value })}
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
            cursor: "pointer",
          }}
        >
          {PROVIDER_MODELS[config.provider].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
