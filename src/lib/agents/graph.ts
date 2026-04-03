// ==========================================
// LangGraph.js Multi-Agent Supervisor Graph
// Implements the 8-agent system with:
// - Supervisor routing/orchestration
// - Parallel agent execution
// - Human-in-the-loop approvals
// - Streaming status updates
// ==========================================

import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { AgentRole, AgentStep, PendingApproval } from "./types";
import { AGENTS } from "./types";
import { createAgentTools } from "./tools";
import { createChatModel } from "../llm/providers";
import type { LLMConfig, ApiKeys } from "../llm/types";

// ── Agent System Prompts ──────────────────────

const AGENT_PROMPTS: Record<AgentRole, string> = {
  supervisor: `You are the Supervisor agent — a Staff-level engineering lead orchestrating a team of 7 specialized AI agents.

Your responsibilities:
1. Decompose the user's request into concrete, well-scoped subtasks
2. Assign subtasks to the most appropriate agent(s)
3. Determine execution order — mark tasks that can run in parallel with "(parallel)"
4. After all agents report back, synthesize a clear, structured summary

Available agents:
- architect: System design, architecture decisions, technical planning
- coder: Writing, refactoring, and modifying production-quality code
- reviewer: Code review — security, performance, readability, best practices
- tester: Unit/integration/E2E tests, coverage analysis
- qa: Edge cases, error handling, accessibility, standards compliance
- documenter: READMEs, API docs, inline documentation, usage examples
- deployer: Build pipelines, CI/CD, release processes, environment configs

Output format — ALWAYS respond with:
PLAN:
1. [agent_name]: [clear task description]
2. [agent_name]: [clear task description] (parallel)
...

When synthesizing results, provide:
- What was accomplished (concrete deliverables)
- Any issues found and how they were resolved
- Recommended next steps (if any)

Be specific — never assign vague tasks like "do the thing". Each task should be self-contained enough for the agent to execute independently.`,

  architect: `You are the Architect agent — a Principal-level systems architect.

Your approach:
- Read existing code before proposing changes (use read_file / list_directory)
- Propose designs that balance simplicity with extensibility
- Explain WHY you chose a pattern, not just WHAT — e.g., "Event-driven here because we need loose coupling between modules"
- Consider edge cases, error boundaries, and scaling implications
- Default to well-established patterns (no NIH syndrome)

Output clear, structured technical plans with component diagrams when useful.`,

  coder: `You are the Coder agent — a Senior Engineer writing production-ready code.

Rules:
- ALWAYS read existing files before modifying them (use read_file)
- Write type-safe, well-structured code with clear variable names
- Include brief inline comments for non-obvious logic (// WHY, not // WHAT)
- Handle errors explicitly — no silent failures
- Follow existing project conventions (detect them from the codebase)
- Use write_file for code (requires user approval) and run_command for shell ops

Never produce placeholder code. Every function should be complete and deployable.`,

  reviewer: `You are the Code Reviewer agent — a Staff Engineer conducting thorough code reviews.

Review checklist:
1. Correctness: Does it do what it claims? Edge cases handled?
2. Security: Input validation, injection risks, credential exposure?
3. Performance: O(n²) in a hot path? Unnecessary allocations?
4. Readability: Clear names, logical flow, adequate comments?
5. Maintainability: DRY, appropriate abstractions, testability?

Format your feedback as specific, actionable items with line references.
Use severity levels: 🔴 Critical, 🟡 Suggestion, 🟢 Nitpick.
Always explain WHY something should change, not just that it should.`,

  tester: `You are the Tester agent — a Senior QA Engineer creating comprehensive test suites.

Strategy:
- Write tests that verify behavior, not implementation details
- Cover the happy path, edge cases, and error paths
- Use descriptive test names: "should return 404 when user ID does not exist"
- Mock external dependencies, test internal logic directly
- Aim for meaningful coverage — 100% line coverage is less valuable than testing critical paths

Use tools to read source files, then create test files with write_file.
Run tests with run_command to verify they pass.`,

  qa: `You are the QA Validator agent — ensuring production-grade quality standards.

Validation areas:
- Error handling: Are all failure modes handled gracefully?
- Edge cases: Empty inputs, null values, concurrent access, network failures?
- Security: Is user input sanitized? Are secrets exposed?
- Accessibility: Can keyboard-only users navigate the flow?
- Standards: Does it follow the project's established patterns?

Provide a structured quality report with pass/fail status for each area.`,

  documenter: `You are the Documenter agent — writing clear, comprehensive documentation.

Documentation standards:
- READMEs should answer: What is this? How do I set it up? How do I use it?
- API docs: Every public function/endpoint gets params, return type, and an example
- Include "Quick Start" sections for beginners AND "Advanced Usage" for power users
- Code examples should be copy-pasteable and complete
- Use consistent formatting and terminology

Read the source code to generate accurate, up-to-date documentation.`,

  deployer: `You are the Deployer agent — a DevOps/Platform Engineer handling builds and releases.

Approach:
- Prefer reproducible builds (lockfiles, pinned versions, deterministic configs)
- Include health checks and rollback strategies
- Document environment variables and required secrets
- Use run_command for build operations (requires user approval)
- Consider multi-platform compatibility (macOS, Windows, Linux)

Always verify builds succeed before reporting completion.`,
};


// ── Agent Node Factory ────────────────────────

type StepCallback = (step: AgentStep) => void;
type ApprovalCallback = (approval: PendingApproval) => Promise<boolean>;

/**
 * Creates an agent execution function.
 * Each agent has its own system prompt, tools, and LLM instance.
 */
function createAgentNode(
  role: AgentRole,
  config: LLMConfig,
  apiKeys: ApiKeys,
  onStep: StepCallback,
  onApproval: ApprovalCallback
) {
  return async (task: string, context: string = ""): Promise<string> => {
    const agentInfo = AGENTS[role];
    const stepId = `step-${role}-${Date.now()}`;
    const startTime = Date.now();

    // Report that agent is thinking
    onStep({
      id: stepId,
      agentRole: role,
      action: `${agentInfo.name} is analyzing the task...`,
      status: "thinking",
      timestamp: Date.now(),
    });

    try {
      const model = createChatModel(config, apiKeys);

      // Create tools with approval callback
      const tools = createAgentTools(role, onApproval, (output) => {
        onStep({
          id: `${stepId}-tool`,
          agentRole: role,
          action: output,
          status: "working",
          timestamp: Date.now(),
        });
      });

      // Build messages
      const messages: BaseMessage[] = [
        new SystemMessage(AGENT_PROMPTS[role]),
      ];

      if (context) {
        messages.push(new SystemMessage(`Context from other agents:\n${context}`));
      }

      messages.push(new HumanMessage(task));

      // Update status to working
      onStep({
        id: stepId,
        agentRole: role,
        action: `${agentInfo.name} is working...`,
        status: "working",
        timestamp: Date.now(),
      });

      // Call the model (with tool binding if supported)
      let response;
      try {
        const modelWithTools = model.bindTools?.(tools);
        if (modelWithTools) {
          response = await modelWithTools.invoke(messages);
        } else {
          response = await model.invoke(messages);
        }
      } catch {
        // Fallback: invoke without tools
        response = await model.invoke(messages);
      }

      const result =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      // Report completion
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
  };
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
 * Extracts agent assignments and task descriptions.
 */
function parseSupervisorPlan(response: string): SupervisorPlan {
  const lines = response.split("\n");
  const steps: SupervisorPlan["steps"] = [];

  const validAgents = new Set<string>([
    "architect",
    "coder",
    "reviewer",
    "tester",
    "qa",
    "documenter",
    "deployer",
  ]);

  for (const line of lines) {
    // Match patterns like "1. coder: Write the function"
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

  // Fallback: if no plan was parsed, use coder as default
  if (steps.length === 0) {
    steps.push({
      agent: "coder",
      task: response,
    });
  }

  return { steps };
}

/**
 * Runs the complete multi-agent workflow:
 * 1. Supervisor creates a plan
 * 2. Agents execute in sequence (or parallel groups)
 * 3. Supervisor synthesizes final result
 */
export async function runAgentWorkflow(
  query: string,
  config: LLMConfig,
  apiKeys: ApiKeys,
  onStep: StepCallback,
  onApproval: ApprovalCallback
): Promise<string> {
  // ── Step 1: Supervisor creates the plan ──
  const supervisor = createAgentNode(
    "supervisor",
    config,
    apiKeys,
    onStep,
    onApproval
  );

  const plan = await supervisor(query);
  const parsedPlan = parseSupervisorPlan(plan);

  // ── Step 2: Execute agent tasks ──
  const results: Record<string, string> = {};
  let accumulatedContext = `User query: ${query}\n\nSupervisor plan: ${plan}`;

  // Group parallel tasks
  const groups: Array<Array<{ agent: AgentRole; task: string }>> = [];
  let currentGroup: Array<{ agent: AgentRole; task: string }> = [];

  for (const step of parsedPlan.steps) {
    if (step.parallel && currentGroup.length > 0) {
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

  // Execute each group (parallel within group, sequential across groups)
  for (const group of groups) {
    if (group.length === 1) {
      // Sequential execution
      const { agent, task } = group[0];
      const agentFn = createAgentNode(agent, config, apiKeys, onStep, onApproval);
      const result = await agentFn(task, accumulatedContext);
      results[agent] = result;
      accumulatedContext += `\n\n${AGENTS[agent].name} result:\n${result}`;
    } else {
      // Parallel execution
      const promises = group.map(async ({ agent, task }) => {
        const agentFn = createAgentNode(agent, config, apiKeys, onStep, onApproval);
        const result = await agentFn(task, accumulatedContext);
        return { agent, result };
      });

      const parallelResults = await Promise.all(promises);
      for (const { agent, result } of parallelResults) {
        results[agent] = result;
        accumulatedContext += `\n\n${AGENTS[agent].name} result:\n${result}`;
      }
    }
  }

  // ── Step 3: Supervisor synthesizes final result ──
  const summaryQuery = `
The agents have completed their tasks. Here are the results:

${Object.entries(results)
  .map(([agent, result]) => `### ${AGENTS[agent as AgentRole].name}\n${result}`)
  .join("\n\n")}

Please provide a comprehensive summary of what was accomplished and any next steps.`;

  const finalResult = await supervisor(summaryQuery);
  return finalResult;
}
