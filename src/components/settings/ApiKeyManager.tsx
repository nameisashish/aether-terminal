// ==========================================
// API Key Manager Component
// Settings UI for managing API keys for all
// supported LLM providers. Now includes
// Local (Ollama) and OpenRouter.
// ==========================================

import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X, Key, Trash2, Wifi, WifiOff, Download } from "lucide-react";
import { useAiStore } from "../../stores/aiStore";
import type { LLMProvider } from "../../lib/llm/types";
import { PROVIDER_INFO, PROVIDER_MODELS } from "../../lib/llm/types";
import { testOllamaConnection, getOllamaModels } from "../../lib/llm/providers";

const CLOUD_PROVIDERS: LLMProvider[] = ["groq", "openai", "anthropic", "gemini", "xai", "openrouter"];

export function ApiKeyManager() {
  const { apiKeys, setApiKey, removeApiKey, config, setConfig } = useAiStore();
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Check Ollama connection on mount
  useEffect(() => {
    checkOllama();
  }, []);

  const checkOllama = async () => {
    setOllamaStatus("checking");
    const online = await testOllamaConnection();
    setOllamaStatus(online ? "online" : "offline");
    if (online) {
      const models = await getOllamaModels();
      setOllamaModels(models);
    }
  };

  const handleSave = (provider: LLMProvider) => {
    if (inputValue.trim()) {
      setApiKey(provider, inputValue.trim());
      // Auto-select this provider and its best model when key is saved
      const bestModel = PROVIDER_MODELS[provider][0];
      setConfig({ provider, model: bestModel });
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

  const isLocalActive = config.provider === "local";

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
        API Keys & Model Provider
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

      {/* ── Local (Ollama) Provider ── */}
      <div
        style={{
          padding: "14px",
          borderRadius: "10px",
          border: `1px solid ${isLocalActive ? "#34d39940" : "var(--border-subtle)"}`,
          background: isLocalActive ? "#34d39908" : "var(--bg-tertiary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#34d399",
              }}
            >
              🏠 Local — Gemma 4 (Ollama)
            </span>
            {isLocalActive && (
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
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {/* Status indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                color: ollamaStatus === "online" ? "var(--green)" : ollamaStatus === "offline" ? "var(--red)" : "var(--yellow)",
              }}
            >
              {ollamaStatus === "online" ? (
                <><Wifi size={12} /> Running</>
              ) : ollamaStatus === "offline" ? (
                <><WifiOff size={12} /> Not running</>
              ) : (
                <>Checking...</>
              )}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => {
                const model = ollamaModels.length > 0 ? ollamaModels[0] : "auto";
                setConfig({ provider: "local", model });
              }}
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                color: isLocalActive ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {isLocalActive ? "✓ Selected" : "Use Local"}
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            lineHeight: "1.6",
          }}
        >
          <strong style={{ color: "var(--text-secondary)" }}>No API key needed.</strong>{" "}
          Gemma 4 runs entirely on your machine via Ollama.
        </div>

        {ollamaStatus === "offline" && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(251, 191, 36, 0.06)",
              border: "1px solid rgba(251, 191, 36, 0.15)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: "1.6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, marginBottom: "4px", color: "var(--yellow)" }}>
              <Download size={13} />
              Setup Ollama
            </div>
            <div>
              1. Install Ollama: <code style={{ background: "var(--bg-primary)", padding: "1px 6px", borderRadius: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>brew install ollama</code> (macOS) or visit <span style={{ color: "var(--accent)" }}>ollama.com</span><br />
              2. Start Ollama: <code style={{ background: "var(--bg-primary)", padding: "1px 6px", borderRadius: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>ollama serve</code><br />
              3. Pull a model: <code style={{ background: "var(--bg-primary)", padding: "1px 6px", borderRadius: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>ollama pull gemma2:9b</code>
            </div>
            <button
              className="btn btn-ghost"
              onClick={checkOllama}
              style={{ fontSize: "11px", padding: "4px 10px", marginTop: "8px" }}
            >
              ↻ Retry connection
            </button>
          </div>
        )}

        {ollamaModels.length > 0 && (
          <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-secondary)" }}>Available models:</span>{" "}
            {ollamaModels.slice(0, 5).join(", ")}
            {ollamaModels.length > 5 && ` +${ollamaModels.length - 5} more`}
          </div>
        )}
      </div>

      {/* ── Cloud Providers ── */}
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginTop: "4px",
        }}
      >
        Cloud Providers
      </div>

      {CLOUD_PROVIDERS.map((provider) => {
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
                      onClick={() => {
                        setConfig({ provider, model: PROVIDER_MODELS[provider][0] });
                      }}
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

            {/* Description */}
            {!hasKey && !isEditing && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                {info.description}
              </div>
            )}

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
          {/* Show Ollama models if local and models are available */}
          {config.provider === "local" && ollamaModels.length > 0
            ? ollamaModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            : PROVIDER_MODELS[config.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
        </select>
      </div>
    </div>
  );
}
