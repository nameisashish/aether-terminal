// ==========================================
// File Viewer Component
// Displays file content when a file is clicked
// in the explorer. Supports:
// - Syntax-aware display with line numbers
// - "Send to AI" button
// - File path breadcrumb
// - Close button to return to terminal
// ==========================================

import { useCallback } from "react";
import {
  X,
  Send,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useAiStore } from "../../stores/aiStore";

export function FileViewer() {
  const { openFilePath, openFileContent, openFileLanguage, closeFile } = useWorkspaceStore();
  const { setChatPanelOpen, sendMessage } = useAiStore();
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const [copied, setCopied] = useState(false);

  const handleSendToAI = useCallback(async () => {
    if (!openFilePath || !openFileContent) return;
    const relativePath = workspacePath
      ? openFilePath.replace(workspacePath, ".")
      : openFilePath;
    setChatPanelOpen(true);
    await sendMessage(
      `Here is the content of \`${relativePath}\`. Please analyze it:\n\n\`\`\`${openFileLanguage || ""}\n${openFileContent.slice(0, 8000)}\n\`\`\``,
      workspacePath
    );
  }, [openFilePath, openFileContent, openFileLanguage, workspacePath, setChatPanelOpen, sendMessage]);

  const handleCopy = useCallback(async () => {
    if (!openFileContent) return;
    await navigator.clipboard.writeText(openFileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [openFileContent]);

  if (!openFilePath || !openFileContent) return null;

  const filename = openFilePath.split("/").pop() || openFilePath;
  const relativePath = workspacePath
    ? openFilePath.replace(workspacePath + "/", "")
    : openFilePath;
  const lines = openFileContent.split("\n");

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FileCode size={14} style={{ color: "var(--blue)" }} />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {filename}
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {relativePath}
          </span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            className="icon-btn"
            onClick={handleCopy}
            title="Copy file content"
            style={{ width: "26px", height: "26px" }}
          >
            {copied ? <Check size={12} style={{ color: "var(--green)" }} /> : <Copy size={12} />}
          </button>
          <button
            className="icon-btn"
            onClick={handleSendToAI}
            title="Send to AI for analysis"
            style={{
              width: "auto",
              height: "26px",
              padding: "0 8px",
              gap: "4px",
              display: "flex",
              alignItems: "center",
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--accent)",
            }}
          >
            <Send size={11} />
            AI
          </button>
          <button
            className="icon-btn"
            onClick={closeFile}
            title="Close file (back to terminal)"
            style={{ width: "26px", height: "26px" }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* File content with line numbers */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          padding: "0",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            {lines.map((line, idx) => (
              <tr
                key={idx}
                style={{
                  height: "21px",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Line number */}
                <td
                  style={{
                    width: "48px",
                    textAlign: "right",
                    padding: "0 12px 0 8px",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    userSelect: "none",
                    borderRight: "1px solid var(--border-subtle)",
                    verticalAlign: "top",
                  }}
                >
                  {idx + 1}
                </td>
                {/* Code */}
                <td
                  style={{
                    padding: "0 12px",
                    whiteSpace: "pre",
                    color: "var(--text-primary)",
                    overflow: "hidden",
                  }}
                >
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "4px 12px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        <span>{lines.length} lines · {openFileLanguage || "plain text"}</span>
        <span>{(openFileContent.length / 1024).toFixed(1)} KB</span>
      </div>
    </div>
  );
}
