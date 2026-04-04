// ==========================================
// Status Bar Component
// Bottom bar with connection status, workspace,
// AI status, keyboard shortcuts hint, and
// terminal dimensions.
// ==========================================

import { useTerminalStore } from "../../stores/terminalStore";
import { useAiStore } from "../../stores/aiStore";
import { useAgentStore } from "../../stores/agentStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { PROVIDER_INFO } from "../../lib/llm/types";

export function StatusBar() {
  const { tabs, activeTabId } = useTerminalStore();
  const { aiMode, config, apiKeys } = useAiStore();
  const { currentTask } = useAgentStore();
  const { workspacePath } = useWorkspaceStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const hasApiKey = !!apiKeys[config.provider];
  const providerInfo = PROVIDER_INFO[config.provider];

  return (
    <div className="status-bar">
      {/* Left: Connection + Workspace */}
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
        {workspacePath && (
          <>
            <span style={{ opacity: 0.3 }}>│</span>
            <span
              style={{
                maxWidth: "180px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--accent)",
                fontWeight: 500,
              }}
              title={workspacePath}
            >
              📂 {workspacePath.split("/").pop()}
            </span>
          </>
        )}
      </div>

      {/* Center: AI status */}
      <div className="status-bar-item">
        {aiMode && (
          <>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>AI</span>
            <span style={{ opacity: 0.3 }}>│</span>
            <span style={{ color: (config.provider === "local" || hasApiKey) ? providerInfo.color : "var(--red)" }}>
              {config.provider === "local"
                ? `Local · ${config.model}`
                : hasApiKey
                ? `${providerInfo.name} · ${config.model}`
                : `${providerInfo.name} (no key)`}
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
