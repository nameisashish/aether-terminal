// ==========================================
// Approval Dialog Component — Power-user UX
// Human-in-the-loop approval modal with:
// - Clear context about what's happening
// - Quick keyboard shortcuts (Enter/Esc)
// - Risk level indicators
// - "Trust this agent" future option area
// ==========================================

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Terminal, FileText, AlertTriangle, Check, X } from "lucide-react";
import type { PendingApproval } from "../../lib/agents/types";
import { AGENTS } from "../../lib/agents/types";
import { useAgentStore } from "../../stores/agentStore";

interface ApprovalDialogProps {
  approval: PendingApproval;
}

export function ApprovalDialog({ approval }: ApprovalDialogProps) {
  const { resolveApproval } = useAgentStore();
  const agentInfo = AGENTS[approval.agentRole];

  // Keyboard shortcuts: Enter = approve, Escape = reject
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        resolveApproval(approval.id, "approve");
      } else if (e.key === "Escape") {
        resolveApproval(approval.id, "reject");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [approval.id, resolveApproval]);

  const typeIcon = {
    shell_command: <Terminal size={16} />,
    file_write: <FileText size={16} />,
    file_delete: <AlertTriangle size={16} />,
    destructive: <AlertTriangle size={16} />,
  };

  const typeLabel = {
    shell_command: "Shell Command",
    file_write: "File Write",
    file_delete: "File Delete",
    destructive: "Destructive Action",
  };

  const riskLevel = {
    shell_command: { label: "Medium Risk", color: "var(--yellow)" },
    file_write: { label: "Low Risk", color: "var(--green)" },
    file_delete: { label: "High Risk", color: "var(--red)" },
    destructive: { label: "High Risk", color: "var(--red)" },
  };

  const risk = riskLevel[approval.type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            width: "500px",
            maxHeight: "70vh",
            background: "var(--bg-secondary)",
            borderRadius: "12px",
            border: "1px solid var(--border-active)",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(124, 92, 252, 0.06)",
            }}
          >
            <Shield size={18} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Action Requires Approval
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                {agentInfo.icon} {agentInfo.name} wants to perform an action
              </div>
            </div>
            {/* Risk badge */}
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "4px",
                background: risk.color + "15",
                color: risk.color,
                border: `1px solid ${risk.color}30`,
              }}
            >
              {risk.label}
            </span>
          </div>

          {/* Content */}
          <div style={{ padding: "16px 20px" }}>
            {/* Action type */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "12px",
              }}
            >
              {typeIcon[approval.type]}
              <span>{typeLabel[approval.type]}</span>
            </div>

            {/* Action description */}
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "12px",
              }}
            >
              {approval.action}
            </div>

            {/* Detail/code block */}
            <div
              style={{
                background: "var(--bg-primary)",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
                maxHeight: "200px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {approval.detail}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "12px 20px 16px",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {/* Keyboard hint */}
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              Enter to approve · Esc to reject
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn btn-ghost"
                onClick={() => resolveApproval(approval.id, "reject")}
                style={{ fontSize: "13px", color: "var(--red)" }}
              >
                <X size={14} />
                Reject
              </button>
              <button
                className="btn btn-primary"
                onClick={() => resolveApproval(approval.id, "approve")}
                style={{ fontSize: "13px" }}
                autoFocus
              >
                <Check size={14} />
                Approve
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
