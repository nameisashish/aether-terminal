// ==========================================
// Title Bar Component
// Top bar with app title, file explorer toggle,
// agent team, AI mode, and settings buttons.
// ==========================================

import { Sparkles, Settings, Users, FolderOpen } from "lucide-react";

interface TitleBarProps {
  aiMode: boolean;
  onToggleAiMode: () => void;
  onOpenSettings: () => void;
  onToggleAgents: () => void;
  agentDashboardOpen: boolean;
  onToggleExplorer: () => void;
  explorerOpen: boolean;
}

export function TitleBar({
  aiMode,
  onToggleAiMode,
  onOpenSettings,
  onToggleAgents,
  agentDashboardOpen,
  onToggleExplorer,
  explorerOpen,
}: TitleBarProps) {
  return (
    <div className="title-bar">
      {/* Left: App branding + explorer toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          className="icon-btn"
          onClick={onToggleExplorer}
          title="File Explorer"
          style={{
            color: explorerOpen ? "var(--accent)" : "var(--text-muted)",
            background: explorerOpen ? "var(--accent-muted)" : "transparent",
            borderRadius: "6px",
            width: "28px",
            height: "28px",
          }}
        >
          <FolderOpen size={15} />
        </button>
        <span
          className="title-bar-text"
          style={{ fontWeight: 600, letterSpacing: "0.05em" }}
        >
          AETHER
        </span>
        <span className="title-bar-text" style={{ opacity: 0.4 }}>
          Terminal
        </span>
      </div>

      {/* Right: Controls */}
      <div
        className="title-bar-controls"
        style={{ display: "flex", gap: "4px" }}
      >
        {/* Agent team toggle */}
        <button
          className="icon-btn"
          onClick={onToggleAgents}
          title="Agent Team"
          style={{
            color: agentDashboardOpen ? "var(--accent)" : "var(--text-muted)",
            background: agentDashboardOpen
              ? "var(--accent-muted)"
              : "transparent",
            borderRadius: "6px",
            width: "auto",
            padding: "0 10px",
            gap: "4px",
            display: "flex",
            alignItems: "center",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <Users size={14} />
          {agentDashboardOpen && <span>Agents</span>}
        </button>

        {/* AI toggle */}
        <button
          className="icon-btn"
          onClick={onToggleAiMode}
          title={aiMode ? "Disable AI Mode" : "Enable AI Mode"}
          style={{
            color: aiMode ? "var(--accent)" : "var(--text-muted)",
            background: aiMode ? "var(--accent-muted)" : "transparent",
            borderRadius: "6px",
            width: "auto",
            padding: "0 10px",
            gap: "4px",
            display: "flex",
            alignItems: "center",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <Sparkles size={14} />
          {aiMode && <span>AI</span>}
        </button>

        {/* Settings */}
        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
