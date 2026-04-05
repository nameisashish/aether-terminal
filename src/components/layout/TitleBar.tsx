// ==========================================
// Title Bar Component
// Top bar with app title, file explorer toggle,
// AI mode, and settings buttons.
// ==========================================

import { Sparkles, Settings, FolderOpen } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";

interface TitleBarProps {
  aiMode: boolean;
  onToggleAiMode: () => void;
  onOpenSettings: () => void;
  onToggleExplorer: () => void;
  explorerOpen: boolean;
}

export function TitleBar({
  aiMode,
  onToggleAiMode,
  onOpenSettings,
  onToggleExplorer,
  explorerOpen,
}: TitleBarProps) {
  const { workspacePath } = useWorkspaceStore();

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
        {workspacePath && (
          <>
            <span style={{ opacity: 0.2, margin: "0 4px" }}>|</span>
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                fontWeight: 500,
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={workspacePath}
            >
              {workspacePath.split("/").pop()}
            </span>
          </>
        )}
      </div>

      {/* Right: Controls */}
      <div
        className="title-bar-controls"
        style={{ display: "flex", gap: "4px" }}
      >
        {/* AI toggle — unified AI + Agent Team */}
        <button
          className="icon-btn"
          onClick={onToggleAiMode}
          title={aiMode ? "Close AI" : "Open AI"}
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
