// ==========================================
// Agent Dashboard Component
// Shows status of all agents, execution steps,
// and the current task progress. Features live
// streaming activity feed.
// ==========================================

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAgentStore } from "../../stores/agentStore";
import { ApprovalDialog } from "./ApprovalDialog";
import { AGENTS, type AgentRole, type AgentStatus } from "../../lib/agents/types";

const STATUS_ICONS: Record<AgentStatus, React.ReactNode> = {
  idle: <Clock size={12} style={{ color: "var(--text-muted)" }} />,
  thinking: <Loader2 size={12} style={{ color: "var(--yellow)" }} className="animate-spin" />,
  working: <Loader2 size={12} style={{ color: "var(--blue)" }} className="animate-spin" />,
  waiting_approval: <AlertCircle size={12} style={{ color: "var(--yellow)" }} />,
  done: <CheckCircle2 size={12} style={{ color: "var(--green)" }} />,
  error: <XCircle size={12} style={{ color: "var(--red)" }} />,
};

export function AgentDashboard() {
  const {
    currentTask,
    dashboardOpen,
    setDashboardOpen,
    startTask,
    cancelTask,
  } = useAgentStore();

  const [input, setInput] = useState("");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const activityRef = useRef<HTMLDivElement>(null);

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight;
    }
  }, [currentTask?.steps]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    startTask(trimmed);
  };

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!dashboardOpen) return null;

  // Get latest status per agent
  const agentStatuses: Partial<Record<AgentRole, AgentStatus>> = {};
  if (currentTask) {
    for (const step of currentTask.steps) {
      agentStatuses[step.agentRole] = step.status;
    }
  }

  return (
    <>
      {/* Render any pending approval dialogs */}
      {currentTask?.pendingApprovals.map((approval) => (
        <ApprovalDialog key={approval.id} approval={approval} />
      ))}

      <AnimatePresence>
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-secondary)",
            borderLeft: "1px solid var(--border-subtle)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                Agent Team
              </span>
              {currentTask?.isRunning && (
                <Loader2
                  size={12}
                  style={{ color: "var(--accent)" }}
                  className="animate-spin"
                />
              )}
            </div>
            <button
              className="icon-btn"
              onClick={() => setDashboardOpen(false)}
              style={{ width: "28px", height: "28px" }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Agent Status Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px",
              padding: "8px",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            {(Object.entries(AGENTS) as [AgentRole, typeof AGENTS[AgentRole]][]).map(
              ([role, info]) => {
                const status = agentStatuses[role] || "idle";
                return (
                  <div
                    key={role}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      background:
                        status !== "idle"
                          ? info.color + "10"
                          : "transparent",
                      border: `1px solid ${
                        status !== "idle"
                          ? info.color + "30"
                          : "transparent"
                      }`,
                    }}
                  >
                    <span>{info.icon}</span>
                    {STATUS_ICONS[status]}
                    <span
                      style={{
                        color:
                          status !== "idle"
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        fontWeight: status !== "idle" ? 500 : 400,
                      }}
                    >
                      {info.name}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          {/* Activity Feed */}
          <div
            ref={activityRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {!currentTask && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: "12px",
                  color: "var(--text-muted)",
                }}
              >
                <Users size={28} strokeWidth={1.5} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: "13px" }}>
                  Describe a task for the agent team
                </span>
                <span style={{ fontSize: "11px", opacity: 0.6 }}>
                  e.g. "Build a REST API with Express"
                </span>
              </div>
            )}

            {currentTask?.steps.map((step) => {
              const agentInfo = AGENTS[step.agentRole];
              const isExpanded = expandedSteps.has(step.id);

              return (
                <div
                  key={step.id}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-subtle)",
                    cursor: step.output ? "pointer" : "default",
                  }}
                  onClick={() => step.output && toggleStep(step.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                    }}
                  >
                    <span>{agentInfo.icon}</span>
                    {STATUS_ICONS[step.status]}
                    <span
                      style={{
                        flex: 1,
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {step.action}
                    </span>
                    {step.output && (
                      isExpanded ? (
                        <ChevronUp size={10} style={{ color: "var(--text-muted)" }} />
                      ) : (
                        <ChevronDown size={10} style={{ color: "var(--text-muted)" }} />
                      )
                    )}
                  </div>

                  {isExpanded && step.output && (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        background: "var(--bg-primary)",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                        maxHeight: "150px",
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.5",
                      }}
                    >
                      {step.output.slice(0, 1000)}
                      {step.output.length > 1000 && "...(truncated)"}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Final result */}
            {currentTask && !currentTask.isRunning && currentTask.result && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(74, 222, 128, 0.06)",
                  border: "1px solid rgba(74, 222, 128, 0.2)",
                  marginTop: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--green)",
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckCircle2 size={14} />
                  Task Complete
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentTask.result.slice(0, 2000)}
                </div>
              </div>
            )}

            {/* Error state */}
            {currentTask && !currentTask.isRunning && currentTask.error && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(248, 113, 113, 0.06)",
                  border: "1px solid rgba(248, 113, 113, 0.2)",
                  marginTop: "8px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--red)",
                    marginBottom: "4px",
                  }}
                >
                  Error
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {currentTask.error}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Describe a task for the agents..."
                disabled={currentTask?.isRunning}
                rows={1}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  maxHeight: "80px",
                  lineHeight: "1.5",
                }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 80) + "px";
                }}
              />
              {currentTask?.isRunning ? (
                <button
                  className="btn btn-ghost"
                  onClick={cancelTask}
                  style={{ padding: "8px", borderRadius: "8px", color: "var(--red)" }}
                >
                  <XCircle size={16} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    opacity: !input.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
