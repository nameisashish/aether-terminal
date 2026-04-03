// ==========================================
// Status Bar Component — Dual-audience design
// Bottom bar with connection status, shell info,
// AI status, keyboard shortcuts hint, and
// terminal dimensions.
// ==========================================

import { useTerminalStore } from "../../stores/terminalStore";
import { useAiStore } from "../../stores/aiStore";
import { useAgentStore } from "../../stores/agentStore";
import { PROVIDER_INFO } from "../../lib/llm/types";

export function StatusBar() {
  const { tabs, activeTabId } = useTerminalStore();
  const { aiMode, config, apiKeys } = useAiStore();
  const { currentTask } = useAgentStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const hasApiKey = !!apiKeys[config.provider];
  const providerInfo = PROVIDER_INFO[config.provider];

  return (
    <div className="status-bar">
      {/* Left: Connection status */}
      <div className="status-bar-item">
        <span
          className={`status-dot ${
            activeTab?.isConnected ? "connected" : "disconnected"
          }`}
        />
        <span>
          {activeTab?.isConnected ? "Connected" : "Disconnected"}
        </span>
        <span style={{ opacity: 0.3 }}>│</span>
        <span>zsh</span>
        <span style={{ opacity: 0.3 }}>│</span>
        <span>UTF-8</span>
      </div>

      {/* Center: AI status */}
      <div className="status-bar-item">
        {aiMode && (
          <>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>AI</span>
            <span style={{ opacity: 0.3 }}>│</span>
            <span style={{ color: hasApiKey ? providerInfo.color : "var(--red)" }}>
              {hasApiKey ? `${providerInfo.name} · ${config.model}` : `${providerInfo.name} (no key)`}
            </span>
          </>
        )}
        {currentTask?.isRunning && (
          <>
            <span style={{ opacity: 0.3 }}>│</span>
            <span style={{ color: "var(--yellow)" }}>
              agents working...
            </span>
          </>
        )}
      </div>

      {/* Right: Tab count + shortcuts hint */}
      <div className="status-bar-item">
        <span>
          {tabs.length} {tabs.length === 1 ? "terminal" : "terminals"}
        </span>
        <span style={{ opacity: 0.3 }}>│</span>
        <span style={{ opacity: 0.5 }} title="Keyboard shortcuts">
          ⌘T new tab · ⌘W close
        </span>
      </div>
    </div>
  );
}
