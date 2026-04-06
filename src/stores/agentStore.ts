// ==========================================
// Agent Store (Zustand)
// Manages multi-agent execution state:
// task queue, agent steps, approvals,
// and orchestration lifecycle.
// ==========================================

import { create } from "zustand";
import type {
  AgentStep,
  AgentTaskState,
  ApprovalDecision,
} from "../lib/agents/types";
import { runAgentWorkflow } from "../lib/agents/graph";
import { useAiStore } from "./aiStore";
import { useWorkspaceStore } from "./workspaceStore";
import { useFileStore } from "./fileStore";
interface AgentState {
  // ── State ──
  currentTask: AgentTaskState | null;
  taskHistory: AgentTaskState[];

  // ── Actions ──
  startTask: (query: string) => Promise<void>;
  addStep: (step: AgentStep) => void;
  resolveApproval: (id: string, decision: ApprovalDecision) => void;
  cancelTask: () => void;
}

// Map to store approval resolve callbacks
const approvalCallbacks = new Map<
  string,
  (approved: boolean) => void
>();

export const useAgentStore = create<AgentState>((set) => ({
  currentTask: null,
  taskHistory: [],

  addStep: (step) =>
    set((s) => {
      if (!s.currentTask) return s;
      return {
        currentTask: {
          ...s.currentTask,
          steps: [...s.currentTask.steps, step],
        },
      };
    }),

  resolveApproval: (id, decision) => {
    const callback = approvalCallbacks.get(id);
    if (callback) {
      callback(decision === "approve");
      approvalCallbacks.delete(id);
    }

    set((s) => {
      if (!s.currentTask) return s;
      return {
        currentTask: {
          ...s.currentTask,
          pendingApprovals: s.currentTask.pendingApprovals.filter(
            (a) => a.id !== id
          ),
        },
      };
    });
  },

  cancelTask: () =>
    set((s) => {
      if (s.currentTask) {
        // Clean up pending approval callbacks to prevent memory leaks
        s.currentTask.pendingApprovals.forEach((a) => {
          const cb = approvalCallbacks.get(a.id);
          if (cb) {
            cb(false); // Reject pending approvals
            approvalCallbacks.delete(a.id);
          }
        });
        return {
          currentTask: null,
          taskHistory: [
            ...s.taskHistory,
            { ...s.currentTask, isRunning: false, endTime: Date.now() },
          ],
        };
      }
      return s;
    }),

  startTask: async (query: string) => {
    const taskId = `task-${Date.now()}`;
    const aiState = useAiStore.getState();
    const workspacePath = useWorkspaceStore.getState().workspacePath;
    const selectedFiles = useFileStore.getState().selectedFiles;

    let fileContext = "";
    if (selectedFiles.size > 0) {
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const contexts: string[] = [];
        for (const filePath of selectedFiles) {
          try {
            const content = await readTextFile(filePath);
            const relativePath = workspacePath
              ? filePath.replace(workspacePath + "/", "")
              : filePath;
            contexts.push(`--- ${relativePath} ---\n${content.slice(0, 4000)}`);
          } catch {
            contexts.push(`--- ${filePath} --- (could not read)`);
          }
        }
        fileContext = contexts.join("\n\n");
      } catch {
        // fs plugin not available
      }
    }

    // Initialize task state
    set({
      currentTask: {
        id: taskId,
        query,
        steps: [],
        pendingApprovals: [],
        isRunning: true,
        startTime: Date.now(),
      },
    });

    try {
      // Run the multi-agent workflow
      const result = await runAgentWorkflow(
        query,
        aiState.config,
        aiState.apiKeys,
        // Step callback
        (step) => {
          set((s) => {
            if (!s.currentTask || s.currentTask.id !== taskId) return s;
            // Update or add step
            const existingIdx = s.currentTask.steps.findIndex(
              (st) => st.id === step.id
            );
            const newSteps =
              existingIdx >= 0
                ? s.currentTask.steps.map((st, i) =>
                    i === existingIdx ? step : st
                  )
                : [...s.currentTask.steps, step];

            return {
              currentTask: { ...s.currentTask, steps: newSteps },
            };
          });
        },
        // Approval callback — returns a promise that resolves when user decides
        (approval) => {
          return new Promise<boolean>((resolve) => {
            approvalCallbacks.set(approval.id, resolve);

            set((s) => {
              if (!s.currentTask) {
                resolve(false);
                return s;
              }
              return {
                currentTask: {
                  ...s.currentTask,
                  pendingApprovals: [
                    ...s.currentTask.pendingApprovals,
                    approval,
                  ],
                },
              };
            });
          });
        },
        workspacePath,
        fileContext
      );

      // Task completed successfully
      set((s) => {
        if (!s.currentTask || s.currentTask.id !== taskId) return s;
        const completedTask = {
          ...s.currentTask,
          isRunning: false,
          endTime: Date.now(),
          result,
        };
        return {
          currentTask: completedTask,
          taskHistory: [...s.taskHistory, completedTask],
        };
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      set((s) => {
        if (!s.currentTask || s.currentTask.id !== taskId) return s;
        const errorTask = {
          ...s.currentTask,
          isRunning: false,
          endTime: Date.now(),
          error,
        };
        return {
          currentTask: errorTask,
          taskHistory: [...s.taskHistory, errorTask],
        };
      });
    }
  },
}));
