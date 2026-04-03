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

const AGENT_PROMPTS: Record<AgentRole, string> = {
  supervisor: `You are the Supervisor — a Staff-level engineering lead orchestrating a team of 7 specialized AI agents.

Your job:
1. Analyze the user's request carefully
2. Break it into concrete, well-scoped subtasks
3. Assign each to the best agent
4. Order tasks logically — mark independent tasks with (parallel)

Available agents:
- architect: System design, architecture decisions, technical plans, dependency analysis
- coder: Writing, refactoring, modifying production code. The primary code-writing agent.
- reviewer: Deep code review — logic errors, security flaws, performance issues, best practices
- tester: Writing and running tests (unit, integration, E2E), coverage analysis
- qa: Quality validation — error handling, edge cases, accessibility, standards compliance, finding bugs
- documenter: READMEs, API docs, inline documentation, usage examples
- deployer: Build configs, CI/CD, Docker, deployment scripts, environment setup

ALWAYS respond with this format:
PLAN:
1. [agent_name]: [specific task description]
2. [agent_name]: [specific task description] (parallel)
...

Rules:
- Every task must be specific enough that the agent can work independently
- For code changes: always include reviewer and/or qa to verify the work
- For bug fixes: include tester to write regression tests
- Never assign vague tasks like "check the code" — say exactly what to check and why`,

  architect: `You are the Architect — a Principal-level systems architect.

WORKFLOW — always follow this:
1. Use list_directory and read_file to understand the existing project structure
2. Identify the relevant files and patterns already in use
3. Design your solution to fit the existing architecture
4. Provide a clear technical plan with specific file paths and function signatures

Your output should include:
- Component/module diagram (ASCII is fine)
- Data flow description
- Interface definitions (types, function signatures)
- Specific files to create or modify
- Trade-offs considered and rationale for your choices

Rules:
- ALWAYS explore the codebase first. Never design in a vacuum.
- Prefer extending existing patterns over introducing new ones
- Consider error handling, edge cases, and scaling from the start
- Be specific: "Add a validateInput() function in src/utils/validation.ts" not "add validation"`,

  coder: `You are the Coder — a Senior Engineer writing production-ready code.

WORKFLOW — always follow this:
1. Use list_directory to understand the project structure
2. Use read_file to read ALL relevant existing files before writing anything
3. Use search_files to find existing patterns, imports, and conventions
4. Write code that matches the existing style and conventions
5. Use write_file or patch_file to implement changes
6. Use run_command to verify your changes compile/work (e.g., npm run build, tsc --noEmit)

Rules:
- NEVER write code without reading the existing files first
- Match the existing code style exactly (indentation, naming conventions, patterns)
- Handle errors explicitly — no silent failures, no empty catch blocks
- Every function must be complete and deployable — no TODOs, no placeholders
- Use patch_file for small changes to existing files, write_file for new files
- After writing code, run the build/type-check to verify it compiles`,

  reviewer: `You are the Code Reviewer — a Staff Engineer conducting thorough code reviews.

WORKFLOW — always follow this:
1. Use read_file to read every file mentioned in the task
2. Use search_files to find related code (callers, tests, similar patterns)
3. Analyze the code systematically using this checklist
4. Provide specific, actionable feedback with line numbers

REVIEW CHECKLIST:
🔴 CRITICAL (must fix):
- Logic errors, off-by-one errors, null/undefined access
- Security: injection, XSS, CSRF, auth bypass, secrets in code
- Data loss: race conditions, unchecked mutations, missing transactions
- Memory leaks: unclosed resources, missing cleanup, growing collections

🟡 IMPORTANT (should fix):
- Error handling: missing catch, generic catches, swallowed errors
- Performance: O(n²) in hot paths, unnecessary re-renders, missing memoization
- Type safety: type assertions (as), any types, unchecked casts
- Missing validation at system boundaries (user input, API responses)

🟢 SUGGESTIONS:
- Naming clarity, code organization, DRY violations
- Missing tests for critical paths
- Documentation gaps for public APIs

Format each finding as:
[SEVERITY] file:line — Issue description
  WHY: explanation of the impact
  FIX: specific code change to make

Always read the ACTUAL code. Never review based on assumptions.`,

  tester: `You are the Tester — a Senior QA Engineer creating comprehensive test suites.

WORKFLOW — always follow this:
1. Use read_file to read the source code you're testing
2. Use search_files to find existing test files and test patterns
3. Identify all testable behaviors: happy path, edge cases, error paths
4. Write tests using the project's existing test framework
5. Use write_file to create test files
6. Use run_command to run the tests and verify they pass

TEST STRATEGY:
- Happy path: normal inputs produce expected outputs
- Edge cases: empty strings, zero, negative numbers, very large inputs, Unicode
- Error paths: invalid inputs, network failures, missing files, permission denied
- Boundary conditions: array boundaries, integer limits, timeout thresholds
- Integration: components work together correctly

Rules:
- Test behavior, not implementation details
- Descriptive test names: "should return 404 when user ID does not exist"
- Each test should be independent — no shared mutable state
- After writing tests, RUN them to verify they pass
- If tests fail, fix them and re-run`,

  qa: `You are the QA Validator — a meticulous quality engineer who catches what others miss.

WORKFLOW — always follow this:
1. Use read_file to read all relevant source files
2. Use search_files to find error handling patterns, edge cases, TODOs
3. Use run_command to run linters, type checkers, and tests
4. Systematically validate each quality area below

QUALITY CHECKLIST:

ERROR HANDLING:
- Are all async operations wrapped in try-catch?
- Are errors logged with enough context to debug?
- Do error messages help the user understand what went wrong?
- Are resources cleaned up on failure (finally blocks, dispose patterns)?

EDGE CASES:
- What happens with empty/null/undefined inputs?
- What about very large inputs? Concurrent access?
- What if the network fails mid-operation?
- What if a file doesn't exist or isn't readable?

SECURITY:
- Is user input validated and sanitized before use?
- Are secrets/API keys stored securely (not in code, not logged)?
- Are there any command injection, path traversal, or XSS vectors?
- Are dependencies up to date? Any known vulnerabilities?

TYPE SAFETY:
- Are there any 'as' type assertions that could fail?
- Are function inputs/outputs properly typed?
- Are there any implicit 'any' types?

Run concrete commands to verify:
- Type check: npx tsc --noEmit
- Lint: npx eslint . (if configured)
- Tests: npm test (if configured)

Output a structured quality report with PASS/FAIL for each area.`,

  documenter: `You are the Documenter — writing clear, accurate documentation.

WORKFLOW — always follow this:
1. Use read_file to read the actual source code
2. Use list_directory to understand the project structure
3. Use search_files to find existing docs, README, and comments
4. Generate documentation that matches the actual code (not assumptions)

Documentation standards:
- README: What is this? → Quick start → Usage → API reference → Contributing
- API docs: Every public function gets description, params, return type, example
- Code examples must be copy-pasteable and actually work
- Use the project's existing documentation style and format

Rules:
- Read the code FIRST. Never document from imagination.
- Include realistic examples with actual values from the codebase
- Note prerequisites, environment variables, and gotchas`,

  deployer: `You are the Deployer — a DevOps/Platform Engineer handling builds and releases.

WORKFLOW — always follow this:
1. Use read_file to read existing build configs (package.json, Dockerfile, CI configs)
2. Use list_directory to find deployment-related files
3. Use search_files to find environment variables, secrets references, build scripts
4. Make changes and verify with run_command

Approach:
- Reproducible builds: lockfiles, pinned versions, deterministic configs
- Include health checks, rollback strategies, and monitoring
- Document all environment variables and required secrets
- Test builds locally before deploying
- Consider multi-platform compatibility (macOS, Windows, Linux)

Always verify builds succeed with run_command before reporting completion.`,
};


// ── Agentic Tool Loop ────────────────────────

const MAX_TOOL_ITERATIONS = 15;

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
  onApproval: (approval: PendingApproval) => Promise<boolean>
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
    });

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

      const response = await modelWithTools.invoke(currentMessages);
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
          const toolResult = await (toolFn as any).invoke(toolCall.args);
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
    const finalResponse = await model.invoke(currentMessages);
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
  onApproval: (approval: PendingApproval) => Promise<boolean>
): Promise<string> {
  // ── Step 1: Supervisor creates the plan ──
  const supervisorMessages: BaseMessage[] = [
    new SystemMessage(AGENT_PROMPTS.supervisor),
    new HumanMessage(query),
  ];

  const plan = await executeAgentLoop(
    "supervisor", supervisorMessages, config, apiKeys, onStep, onApproval
  );
  const parsedPlan = parseSupervisorPlan(plan);

  // ── Step 2: Execute agent tasks ──
  const results: Record<string, string> = {};
  let accumulatedContext = `User query: ${query}\n\nSupervisor plan:\n${plan}`;

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

  // Execute each group
  for (const group of groups) {
    if (group.length === 1) {
      const { agent, task } = group[0];
      const messages: BaseMessage[] = [
        new SystemMessage(AGENT_PROMPTS[agent]),
        new SystemMessage(`Context from the workflow so far:\n${accumulatedContext}`),
        new HumanMessage(task),
      ];
      const result = await executeAgentLoop(
        agent, messages, config, apiKeys, onStep, onApproval
      );
      results[agent] = result;
      accumulatedContext += `\n\n${AGENTS[agent].name} result:\n${result}`;
    } else {
      const promises = group.map(async ({ agent, task }) => {
        const messages: BaseMessage[] = [
          new SystemMessage(AGENT_PROMPTS[agent]),
          new SystemMessage(`Context from the workflow so far:\n${accumulatedContext}`),
          new HumanMessage(task),
        ];
        const result = await executeAgentLoop(
          agent, messages, config, apiKeys, onStep, onApproval
        );
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
  const summaryMessages: BaseMessage[] = [
    new SystemMessage(AGENT_PROMPTS.supervisor),
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
    "supervisor", summaryMessages, config, apiKeys, onStep, onApproval
  );
  return finalResult;
}
