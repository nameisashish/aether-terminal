// ==========================================
// Agent Type Definitions
// Core types for the multi-agent system.
// Defines agent roles, states, messages,
// tools, and the approval workflow.
// ==========================================

/** All supported agent roles */
export type AgentRole =
  | "supervisor"
  | "architect"
  | "coder"
  | "reviewer"
  | "tester"
  | "qa"
  | "documenter"
  | "deployer";

/** Agent display metadata */
export interface AgentInfo {
  role: AgentRole;
  name: string;
  description: string;
  icon: string; // Emoji icon
  color: string; // Theme color
}

/** Agent info for all 8 agents */
export const AGENTS: Record<AgentRole, AgentInfo> = {
  supervisor: {
    role: "supervisor",
    name: "Supervisor",
    description: "Orchestrates tasks across all agents, manages workflow",
    icon: "🎯",
    color: "#7c5cfc",
  },
  architect: {
    role: "architect",
    name: "Architect",
    description: "Designs system architecture and technical plans",
    icon: "🏗️",
    color: "#60a5fa",
  },
  coder: {
    role: "coder",
    name: "Coder",
    description: "Writes and modifies code based on specifications",
    icon: "💻",
    color: "#4ade80",
  },
  reviewer: {
    role: "reviewer",
    name: "Code Reviewer",
    description: "Reviews code quality, patterns, and best practices",
    icon: "🔍",
    color: "#fbbf24",
  },
  tester: {
    role: "tester",
    name: "Tester",
    description: "Creates and runs tests, validates functionality",
    icon: "🧪",
    color: "#22d3ee",
  },
  qa: {
    role: "qa",
    name: "QA Validator",
    description: "Validates quality, checks edge cases, ensures standards",
    icon: "✅",
    color: "#a78bfa",
  },
  documenter: {
    role: "documenter",
    name: "Documenter",
    description: "Writes documentation, READMEs, and API docs",
    icon: "📝",
    color: "#f87171",
  },
  deployer: {
    role: "deployer",
    name: "Deployer",
    description: "Handles build, deploy, and release processes",
    icon: "🚀",
    color: "#fb923c",
  },
};

/** Status of an agent during execution */
export type AgentStatus = "idle" | "thinking" | "working" | "waiting_approval" | "done" | "error";

/** A single agent execution step */
export interface AgentStep {
  id: string;
  agentRole: AgentRole;
  action: string; // Description of what the agent is doing
  status: AgentStatus;
  output?: string;
  timestamp: number;
  duration?: number; // ms
}

/** A pending action requiring human approval */
export interface PendingApproval {
  id: string;
  agentRole: AgentRole;
  action: string; // Human-readable description
  detail: string; // Full command or file content
  type: "shell_command" | "file_write" | "file_delete" | "destructive";
  timestamp: number;
  diffData?: {
    originalContent: string;
    newContent: string;
    filePath: string;
  };
}

/** Possible approval decisions */
export type ApprovalDecision = "approve" | "reject" | "edit";

/** Complete state of an agent task execution */
export interface AgentTaskState {
  id: string;
  query: string; // Original user query
  steps: AgentStep[];
  pendingApprovals: PendingApproval[];
  isRunning: boolean;
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
}

/** Tool call from an agent */
export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  agentRole: AgentRole;
}
