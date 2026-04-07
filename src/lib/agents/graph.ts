// ==========================================
// LangGraph.js Multi-Agent Supervisor Graph
// Implements the 8-agent system with:
// - Supervisor routing/orchestration
// - Agentic tool-calling loop (invoke → tool → result → repeat)
// - Parallel agent execution
// - Human-in-the-loop approvals
// - Streaming status updates
// ==========================================

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { AgentRole, AgentStep, PendingApproval } from "./types";
import { AGENTS } from "./types";
import { createAgentTools } from "./tools";
import { createChatModel } from "../llm/providers";
import type { LLMConfig, ApiKeys } from "../llm/types";

// ── Agent System Prompts ──────────────────────
// Each agent prompt is designed to operate at the
// absolute top of their field — like hiring the
// best engineer from Google/Stripe/Netflix for
// each specialized role.

const AGENT_PROMPTS: Record<AgentRole, string> = {
  supervisor: `You are the Supervisor — an efficient engineering lead who gets things done fast.

CRITICAL: Use the MINIMUM number of agents needed. Speed and token efficiency matter.

TASK SIZING:
- SIMPLE tasks (UI changes, bug fixes, single-file edits, styling): Just "coder" — ONE agent only
- MEDIUM tasks (multi-file feature, refactoring): "coder" + maybe "reviewer" — max 2 agents
- COMPLEX tasks (new system, architecture change, security-critical): up to 3-4 agents

Available agents: architect, coder, reviewer, tester, qa, documenter, deployer.
Default to JUST coder unless the task clearly needs more.

PLANNING FORMAT:
PLAN:
1. agent_name: specific task description
2. agent_name: specific task (parallel)

RULES:
- MINIMIZE agents. 1 agent is better than 3 if 1 can do it.
- Only add reviewer for risky/complex changes, not simple edits.
- Only add tester for bug fixes or logic changes.
- Never add architect for simple tasks.
- Each task must be specific — say exactly what files and what changes.`,

  architect: `You are the Architect. Explore the codebase with list_directory/read_file FIRST, then design.
Output: component overview, file paths to create/modify, trade-offs. Use ABSOLUTE paths. Be specific and concise.`,

  coder: `You are the Coder. You MUST use tools to make REAL changes on disk.

WORKFLOW: list_directory → read_file (understand existing code) → write_file/patch_file (make changes) → run_command (verify build).
RULES:
- Use ABSOLUTE paths for all file operations.
- write_file for new files (auto-creates dirs). patch_file for edits. delete_file to remove.
- read_file BEFORE editing any file. Match existing code style.
- ZERO placeholders. Complete, working code only.
- Verify with run_command after changes.`,

  reviewer: `You are the Code Reviewer. Read the actual files with read_file, then report issues.
Focus on: logic errors, security issues, crashes, missing error handling.
Format: [SEVERITY] file:line — issue. FIX: what to change.
Use patch_file to fix critical issues directly.`,

  tester: `You are the Tester. Read source with read_file, find test conventions with search_files.
Write tests with write_file using the project's test framework. Run with run_command until green.
Cover: happy path, edge cases, error paths. Use ABSOLUTE paths.`,

  qa: `You are the QA Validator. Use read_file to check code quality, run_command for build/lint/test.
Report: error handling, security, type safety, edge cases. Fix critical issues with patch_file.`,

  documenter: `You are the Documenter. Read actual code with read_file first.
Write clear, concise docs. Include working examples. Use write_file with ABSOLUTE paths.`,

  deployer: `You are the Deployer. Read build configs with read_file, verify with run_command.
Focus: reproducible builds, versioning, cross-platform. Use ABSOLUTE paths.`,
};


// ── Agentic Tool Loop ────────────────────────

const MAX_TOOL_ITERATIONS = 8;

/**
 * Executes an agent with a full tool-calling loop.
 * The agent calls the LLM, which may request tool calls.
 * Tools are executed and results fed back to the LLM.
 * This repeats until the LLM produces a final text response.
 */
async function executeAgentLoop(
  role: AgentRole,
  messages: BaseMessage[],
  config: LLMConfig,
  apiKeys: ApiKeys,
  onStep: (step: AgentStep) => void,
  onApproval: (approval: PendingApproval) => Promise<boolean>,
  workspacePath?: string | null
): Promise<string> {
  const agentInfo = AGENTS[role];
  const stepId = `step-${role}-${Date.now()}`;
  const startTime = Date.now();

  onStep({
    id: stepId,
    agentRole: role,
    action: `${agentInfo.name} is analyzing the task...`,
    status: "thinking",
    timestamp: Date.now(),
  });

  try {
    const model = createChatModel(config, apiKeys);
    const tools = createAgentTools(role, onApproval, (output) => {
      onStep({
        id: `${stepId}-tool-${Date.now()}`,
        agentRole: role,
        action: output,
        status: "working",
        timestamp: Date.now(),
      });
    }, workspacePath);

    // Build tool map for execution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolMap = new Map<string, any>(tools.map((t) => [t.name, t]));

    // Try binding tools to the model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modelWithTools: any = model;
    try {
      const bound = model.bindTools?.(tools);
      modelWithTools = bound || model;
    } catch {
      modelWithTools = model;
    }

    // Retry helper for rate limit errors (429)
    const invokeWithRetry = async (m: any, msgs: BaseMessage[], retries = 2): Promise<any> => {
      for (let i = 0; i <= retries; i++) {
        try {
          return await m.invoke(msgs);
        } catch (err: any) {
          const msg = err?.message || String(err);
          if ((msg.includes("429") || msg.includes("rate limit") || msg.includes("Rate limit")) && i < retries) {
            const wait = (i + 1) * 3000; // 3s, 6s
            onStep({ id: `${stepId}-retry`, agentRole: role, action: `Rate limited — waiting ${wait / 1000}s...`, status: "working", timestamp: Date.now() });
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          throw err;
        }
      }
    };

    let currentMessages = [...messages];
    let iterations = 0;

    // Tool-calling loop
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      onStep({
        id: stepId,
        agentRole: role,
        action: iterations === 1
          ? `${agentInfo.name} is working...`
          : `${agentInfo.name} is continuing (step ${iterations})...`,
        status: "working",
        timestamp: Date.now(),
      });

      const response = await invokeWithRetry(modelWithTools, currentMessages);
      currentMessages.push(response);

      // Check if the model requested tool calls
      const toolCalls = response.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls — final response
        const result = typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

        onStep({
          id: stepId,
          agentRole: role,
          action: `${agentInfo.name} completed task`,
          status: "done",
          output: result,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        });

        return result;
      }

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const toolFn = toolMap.get(toolCall.name);
        if (!toolFn) {
          currentMessages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || toolCall.name,
              content: `Error: Unknown tool "${toolCall.name}"`,
            })
          );
          continue;
        }

        onStep({
          id: `${stepId}-tool-${Date.now()}`,
          agentRole: role,
          action: `Using tool: ${toolCall.name}`,
          status: "working",
          timestamp: Date.now(),
        });

        try {
          const toolResult = await (toolFn as any).invoke(toolCall.args || {});
          currentMessages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || toolCall.name,
              content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
            })
          );
        } catch (err) {
          currentMessages.push(
            new ToolMessage({
              tool_call_id: toolCall.id || toolCall.name,
              content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
            })
          );
        }
      }
    }

    // Max iterations reached — get final response without tools
    const finalResponse = await invokeWithRetry(model, currentMessages);
    const result = typeof finalResponse.content === "string"
      ? finalResponse.content
      : JSON.stringify(finalResponse.content);

    onStep({
      id: stepId,
      agentRole: role,
      action: `${agentInfo.name} completed task (max iterations reached)`,
      status: "done",
      output: result,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    });

    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";

    onStep({
      id: stepId,
      agentRole: role,
      action: `${agentInfo.name} encountered an error: ${error}`,
      status: "error",
      timestamp: Date.now(),
    });

    return `Error: ${error}`;
  }
}


// ── Supervisor Graph ──────────────────────────

interface SupervisorPlan {
  steps: Array<{
    agent: AgentRole;
    task: string;
    parallel?: boolean;
  }>;
}

/**
 * Parses the supervisor's plan from its text response.
 */
function parseSupervisorPlan(response: string): SupervisorPlan {
  const lines = response.split("\n");
  const steps: SupervisorPlan["steps"] = [];

  const validAgents = new Set<string>([
    "architect", "coder", "reviewer", "tester", "qa", "documenter", "deployer",
  ]);

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(\w+):\s*(.+)/);
    if (match) {
      const [, agent, task] = match;
      if (validAgents.has(agent)) {
        steps.push({
          agent: agent as AgentRole,
          task: task.trim(),
          parallel: line.includes("[parallel]") || line.includes("(parallel)"),
        });
      }
    }
  }

  if (steps.length === 0) {
    console.warn("[Aether] Supervisor did not provide structured plan, falling back to coder");
    steps.push({ agent: "coder", task: response });
  }

  return { steps };
}

/**
 * Runs the complete multi-agent workflow:
 * 1. Supervisor creates a plan
 * 2. Agents execute with full tool-calling loops
 * 3. Supervisor synthesizes final result
 */
export async function runAgentWorkflow(
  query: string,
  config: LLMConfig,
  apiKeys: ApiKeys,
  onStep: (step: AgentStep) => void,
  onApproval: (approval: PendingApproval) => Promise<boolean>,
  workspacePath?: string | null,
  fileContext?: string
): Promise<string> {
  // ── Step 1: Supervisor creates the plan ──
  let contextInjection = "";
  if (workspacePath) {
    contextInjection += `\n\nCURRENT WORKSPACE: ${workspacePath}`;
  }
  if (fileContext) {
    contextInjection += `\n\nFILES IN CONTEXT (selected by user):\n${fileContext}`;
  }
  const supervisorMessages: BaseMessage[] = [
    new SystemMessage(AGENT_PROMPTS.supervisor + contextInjection),
    new HumanMessage(query),
  ];

  const plan = await executeAgentLoop(
    "supervisor", supervisorMessages, config, apiKeys, onStep, onApproval, workspacePath
  );
  const parsedPlan = parseSupervisorPlan(plan);

  // ── Step 2: Execute agent tasks ──
  const results: Record<string, string> = {};
  let accumulatedContext = `User query: ${query}\n\nSupervisor plan:\n${plan}`;

  // Group parallel tasks
  const groups: Array<Array<{ agent: AgentRole; task: string; parallel?: boolean }>> = [];
  let currentGroup: Array<{ agent: AgentRole; task: string; parallel?: boolean }> = [];

  for (const step of parsedPlan.steps) {
    if (step.parallel && currentGroup.length > 0 && currentGroup[currentGroup.length - 1].parallel !== false) {
      // Add to existing parallel group
      currentGroup.push(step);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [step];
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Execute each group
  for (const group of groups) {
    if (group.length === 1) {
      const { agent, task } = group[0];
      const messages: BaseMessage[] = [
        new SystemMessage(AGENT_PROMPTS[agent] + contextInjection),
        new SystemMessage(`Context from the workflow so far:\n${accumulatedContext}`),
        new HumanMessage(task),
      ];
      const result = await executeAgentLoop(
        agent, messages, config, apiKeys, onStep, onApproval, workspacePath
      );
      results[agent] = result;
      // Cap accumulated context to prevent token explosion
      const resultSnippet = result.length > 8000 ? result.slice(0, 8000) + "\n...(truncated)" : result;
      accumulatedContext += `\n\n${AGENTS[agent].name} result:\n${resultSnippet}`;
      if (accumulatedContext.length > 50000) {
        accumulatedContext = accumulatedContext.slice(-30000);
      }
    } else {
      const promises = group.map(async ({ agent, task }) => {
        const messages: BaseMessage[] = [
          new SystemMessage(AGENT_PROMPTS[agent] + contextInjection),
          new SystemMessage(`Context from the workflow so far:\n${accumulatedContext}`),
          new HumanMessage(task),
        ];
        const result = await executeAgentLoop(
          agent, messages, config, apiKeys, onStep, onApproval, workspacePath
        );
        return { agent, result };
      });

      const parallelResults = await Promise.all(promises);
      for (const { agent, result } of parallelResults) {
        results[agent] = result;
        const resultSnippet = result.length > 8000 ? result.slice(0, 8000) + "\n...(truncated)" : result;
        accumulatedContext += `\n\n${AGENTS[agent].name} result:\n${resultSnippet}`;
      }
      if (accumulatedContext.length > 50000) {
        accumulatedContext = accumulatedContext.slice(-30000);
      }
    }
  }

  // ── Step 3: Supervisor synthesizes final result ──
  const summaryMessages: BaseMessage[] = [
    new SystemMessage(AGENT_PROMPTS.supervisor + contextInjection),
    new HumanMessage(query),
    new AIMessage(plan),
    new HumanMessage(`The agents have completed their tasks. Here are the results:

${Object.entries(results)
  .map(([agent, result]) => {
    const role = agent as AgentRole;
    return `### ${AGENTS[role].name}\n${result}`;
  })
  .join("\n\n")}

Provide a comprehensive summary: what was accomplished, issues found, and recommended next steps.`),
  ];

  const finalResult = await executeAgentLoop(
    "supervisor", summaryMessages, config, apiKeys, onStep, onApproval, workspacePath
  );
  return finalResult;
}
