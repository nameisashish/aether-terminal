// ==========================================
// Main Layout Component — Full Integration
// App shell with synced panels:
// - File explorer (left)
// - Terminal / File viewer (center)
// - AI chat / Agent dashboard (right)
// Everything syncs through workspace context.
// ==========================================

import { useEffect, useState } from "react";
import { TitleBar } from "./TitleBar";
import { StatusBar } from "./StatusBar";
import { TerminalTabs } from "../terminal/TerminalTabs";
import { Terminal } from "../terminal/Terminal";
import { AiChatPanel } from "../ai/AiChatPanel";
import { AgentDashboard } from "../agents/AgentDashboard";
import { FileExplorer } from "../explorer/FileExplorer";
import { FileViewer } from "../explorer/FileViewer";
import { SettingsPanel } from "../settings/SettingsPanel";
import { useTerminalStore, createTab } from "../../stores/terminalStore";
import { useAiStore } from "../../stores/aiStore";
import { useAgentStore } from "../../stores/agentStore";
import { useFileStore } from "../../stores/fileStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export function MainLayout() {
  const { tabs, activeTabId, addTab } = useTerminalStore();
  const { aiMode, toggleAiMode, chatPanelOpen, initializeStore } = useAiStore();
  const { dashboardOpen, setDashboardOpen } = useAgentStore();
  const { explorerOpen, setExplorerOpen } = useFileStore();
  const { openFilePath } = useWorkspaceStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Create initial terminal tab on mount ──
  useEffect(() => {
    if (tabs.length === 0) {
      const tab = createTab();
      addTab(tab);
    }
  }, []);

  // ── Initialize AI store: hydrate persisted keys/config + auto-detect Ollama models ──
  useEffect(() => {
    initializeStore();
  }, []);

  const isViewingFile = !!openFilePath;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      {/* Title Bar */}
      <TitleBar
        aiMode={aiMode}
        onToggleAiMode={toggleAiMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleAgents={() => setDashboardOpen(!dashboardOpen)}
        agentDashboardOpen={dashboardOpen}
        onToggleExplorer={() => setExplorerOpen(!explorerOpen)}
        explorerOpen={explorerOpen}
      />

      {/* Tab Bar */}
      <TerminalTabs />

      {/* Main Content — file explorer + terminal/viewer + side panels */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          position: "relative",
        }}
      >
        {/* File Explorer (left sidebar) */}
        {explorerOpen && <FileExplorer />}

        {/* Center: Terminal or File Viewer */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {/* File Viewer — shown when a file is open */}
          {isViewingFile && (
            <div style={{ height: "50%", borderBottom: "2px solid var(--border-subtle)" }}>
              <FileViewer />
            </div>
          )}

          {/* Terminals */}
          <div
            style={{
              height: isViewingFile ? "50%" : "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {tabs.map((tab) => (
              <Terminal
                key={tab.id}
                tabId={tab.id}
                isActive={tab.id === activeTabId}
              />
            ))}

            {tabs.length === 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px", opacity: 0.3 }}>⌘</span>
                <span>Press + to open a new terminal</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Panel (right side) */}
        {chatPanelOpen && <AiChatPanel />}

        {/* Agent Dashboard (right side) */}
        {dashboardOpen && <AgentDashboard />}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Settings Modal */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
