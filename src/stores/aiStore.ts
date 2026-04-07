// ==========================================
// AI Store (Zustand)
// Unified AI + Agent system. The AI handles
// direct tool calls for simple tasks and
// delegates complex tasks to the 8-agent team
// automatically via smart routing.
//
// KEY FEATURES:
// - Direct tool-calling (read/write/run)
// - Smart delegation to 8-agent specialist team
// - Inline agent progress & approval UI
// - Persistence to localStorage
// ==========================================

import { create } from "zustand";
import type { LLMConfig, ChatMessage, ApiKeys, LLMProvider } from "../lib/llm/types";
import { DEFAULT_LLM_CONFIG, GROQ_FALLBACK_CONFIG } from "../lib/llm/types";
import { streamChat, testOllamaConnection, getOllamaModels } from "../lib/llm/providers";
import { createChatModel } from "../lib/llm/providers";
import { createAgentTools } from "../lib/agents/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentStep, PendingApproval, ApprovalDecision } from "../lib/agents/types";
import { runAgentWorkflow } from "../lib/agents/graph";

// ── Persistence helpers ──
const STORAGE_KEYS = {
  API_KEYS: "aether-api-keys",
  CONFIG: "aether-llm-config",
} as const;

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

// ── Approval callback storage for inline agent approvals ──
const aiApprovalCallbacks = new Map<string, (approved: boolean) => void>();

interface AiState {
  // ── State ──
  aiMode: boolean;
  config: LLMConfig;
  apiKeys: ApiKeys;
  messages: ChatMessage[];
  isStreaming: boolean;
  chatPanelOpen: boolean;
  error: string | null;
  toolActivity: string[];
  agentSteps: AgentStep[];        // Inline agent team progress
  pendingApprovals: PendingApproval[]; // Inline approval requests

  // ── Actions ──
  toggleAiMode: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setConfig: (config: Partial<LLMConfig>) => void;
  setApiKey: (provider: LLMProvider, key: string) => void;
  removeApiKey: (provider: LLMProvider) => void;
  loadApiKeys: (keys: ApiKeys) => void;
  sendMessage: (content: string, workspacePath?: string | null, fileContext?: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  addToolActivity: (activity: string) => void;
  clearToolActivity: () => void;
  resolveApproval: (id: string, decision: ApprovalDecision) => void;
  clearAgentSteps: () => void;
  initializeStore: () => Promise<void>;
}

let messageCounter = 0;
function createMessageId(): string {
  return `msg-${++messageCounter}-${Date.now()}`;
}

/**
 * Fetches a shallow directory tree (2 levels) for the workspace.
 * Returns a formatted string like:
 *   src/
 *     components/
 *     lib/
 *   package.json
 *   tsconfig.json
 */
let _cachedTree: { path: string; tree: string; ts: number } | null = null;
const TREE_CACHE_TTL = 30_000; // 30 seconds

async function getWorkspaceTree(workspacePath: string): Promise<string> {
  // Return cached tree if fresh
  if (_cachedTree && _cachedTree.path === workspacePath && Date.now() - _cachedTree.ts < TREE_CACHE_TTL) {
    return _cachedTree.tree;
  }

  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");

    const entries = await readDir(workspacePath);
    const lines: string[] = [];
    const SKIP = new Set(["node_modules", ".git", "target", "dist", ".next", ".cache", "__pycache__", ".DS_Store", "Thumbs.db"]);

    // Sort: directories first, then files
    const sorted = [...entries].sort((a, b) => {
      const aDir = a.isDirectory ? 0 : 1;
      const bDir = b.isDirectory ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;

      if (entry.isDirectory) {
        lines.push(`${entry.name}/`);
        // One level deeper
        try {
          const subEntries = await readDir(`${workspacePath}/${entry.name}`);
          const subSorted = [...subEntries].sort((a, b) => {
            const aDir = a.isDirectory ? 0 : 1;
            const bDir = b.isDirectory ? 0 : 1;
            if (aDir !== bDir) return aDir - bDir;
            return a.name.localeCompare(b.name);
          });
          let count = 0;
          for (const sub of subSorted) {
            if (SKIP.has(sub.name) || sub.name.startsWith(".")) continue;
            if (count >= 8) { lines.push(`  +${subSorted.length - count} more`); break; }
            lines.push(`  ${sub.name}${sub.isDirectory ? "/" : ""}`);
            count++;
          }
        } catch { /* permission denied or similar */ }
      } else {
        lines.push(entry.name);
      }
    }

    const tree = lines.join("\n");
    _cachedTree = { path: workspacePath, tree, ts: Date.now() };
    return tree;
  } catch (err) {
    console.warn("[Aether] Failed to build workspace tree:", err);
    return "";
  }
}

/**
 * Auto-detect project tech stack from config files.
 * Reads package.json, Cargo.toml, etc. and returns a compact summary.
 * Cached per workspace path.
 */
let _stackCache: { path: string; stack: string; ts: number } | null = null;

async function detectTechStack(workspacePath: string): Promise<string> {
  if (_stackCache && _stackCache.path === workspacePath && Date.now() - _stackCache.ts < TREE_CACHE_TTL) {
    return _stackCache.stack;
  }

  const parts: string[] = [];

  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");

    // package.json — Node/JS/TS projects
    try {
      const pkg = JSON.parse(await readTextFile(`${workspacePath}/package.json`));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 12);
      const scripts = Object.keys(pkg.scripts || {}).slice(0, 6);
      parts.push(`Node: ${pkg.name || "unnamed"}${pkg.version ? " v" + pkg.version : ""}`);
      if (deps.length) parts.push(`Deps: ${deps.join(", ")}`);
      if (scripts.length) parts.push(`Scripts: ${scripts.join(", ")}`);
    } catch { /* no package.json */ }

    // Cargo.toml — Rust projects
    try {
      const cargo = await readTextFile(`${workspacePath}/Cargo.toml`);
      const nameMatch = cargo.match(/name\s*=\s*"(.+?)"/);
      const depSection = cargo.split("[dependencies]")[1]?.split("[")[0] || "";
      const rustDeps = depSection.match(/^(\w[\w-]*)/gm)?.slice(0, 8) || [];
      if (nameMatch) parts.push(`Rust: ${nameMatch[1]}`);
      if (rustDeps.length) parts.push(`Crates: ${rustDeps.join(", ")}`);
    } catch { /* no Cargo.toml */ }

    // requirements.txt / pyproject.toml — Python
    try {
      const reqs = await readTextFile(`${workspacePath}/requirements.txt`);
      const pyDeps = reqs.split("\n").filter(l => l.trim() && !l.startsWith("#")).slice(0, 8).map(l => l.split("=")[0].split(">")[0].split("<")[0].trim());
      if (pyDeps.length) parts.push(`Python deps: ${pyDeps.join(", ")}`);
    } catch {
      try {
        const pyproj = await readTextFile(`${workspacePath}/pyproject.toml`);
        const nameMatch = pyproj.match(/name\s*=\s*"(.+?)"/);
        if (nameMatch) parts.push(`Python: ${nameMatch[1]}`);
      } catch { /* no python config */ }
    }

    // go.mod — Go projects
    try {
      const gomod = await readTextFile(`${workspacePath}/go.mod`);
      const modName = gomod.match(/module\s+(\S+)/)?.[1];
      if (modName) parts.push(`Go: ${modName}`);
    } catch { /* no go.mod */ }

  } catch { /* fs unavailable */ }

  const stack = parts.join(" | ");
  _stackCache = { path: workspacePath, stack, ts: Date.now() };
  return stack;
}

/**
 * System prompt — Claude-Code-style: context-aware, concise, code-first.
 * LOCAL: ultra-compact for small models, no tool listing (they don't tool-call).
 * CLOUD: concise with tools, workflow rules.
 */
function buildSystemPrompt(
  workspacePath?: string | null,
  fileContext?: string,
  workspaceTree?: string,
  isLocal?: boolean,
  techStack?: string
): string {
  // ── LOCAL: compact prompt, core tools ──
  if (isLocal) {
    let prompt = `You are Aether, an AI coding agent. You MUST use tools to make real changes to files. Never just describe what you would do — actually do it.

TOOLS: read_file, write_file, delete_file, patch_file, run_command, list_directory, delegate_to_agents.
CRITICAL RULES:
- ALWAYS use write_file/patch_file to create/modify files. Files MUST appear on disk.
- Use ABSOLUTE paths: ${workspacePath || "/path/to/workspace"}/src/file.ts
- read_file BEFORE modifying. write_file to create new files. patch_file for edits. delete_file to remove.
- For complex multi-file tasks, use delegate_to_agents.
- Lead with code. No placeholders. Short responses.`;

    if (techStack) prompt += `\nStack: ${techStack}`;
    if (workspaceTree) prompt += `\nFiles:\n${workspaceTree}`;
    if (fileContext) prompt += `\nOpen:\n${fileContext}`;
    return prompt;
  }

  // ── CLOUD: all tools + concise workflow ──
  let prompt = `You are Aether, an AI coding agent with full filesystem access. You MUST use tools to make real changes — never just describe what you would do.

CRITICAL RULES:
- ALWAYS use tools to make REAL changes. Files MUST appear on disk.
- Use ABSOLUTE paths: ${workspacePath || "/path/to/workspace"}/filename
- read_file BEFORE editing. write_file creates new files + dirs. patch_file for edits. delete_file to remove.
- Give complete, working code — never placeholders.
- After changes: verify with run_command (build/test).
- Keep responses short. Lead with action, not reasoning.

WHEN TO USE delegate_to_agents vs handle directly:
- SIMPLE (do it yourself): UI changes, bug fixes, single-file edits, styling, adding features to 1-2 files
- COMPLEX (use delegate_to_agents): building entire new systems, 5+ file changes, needs architecture planning

TOOLS: read_file, write_file, delete_file, patch_file, run_command, list_directory, search_files, build_code_graph, get_impact_radius, get_architecture, find_large_functions, delegate_to_agents.`;

    if (techStack) prompt += `\n\nStack: ${techStack}`;
    if (workspaceTree) prompt += `\nFiles:\n${workspaceTree}`;
    if (fileContext) prompt += `\nOpen:\n${fileContext}`;
    return prompt;
}

export const useAiStore = create<AiState>((set, get) => ({
  aiMode: false,
  config: loadFromStorage<LLMConfig>(STORAGE_KEYS.CONFIG, DEFAULT_LLM_CONFIG),
  apiKeys: loadFromStorage<ApiKeys>(STORAGE_KEYS.API_KEYS, {}),
  messages: [],
  isStreaming: false,
  chatPanelOpen: false,
  error: null,
  toolActivity: [],
  agentSteps: [],
  pendingApprovals: [],

  toggleAiMode: () =>
    set((s) => ({ aiMode: !s.aiMode, chatPanelOpen: !s.aiMode ? true : s.chatPanelOpen })),

  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),

  setConfig: (partial) => {
    const newConfig = { ...get().config, ...partial };
    saveToStorage(STORAGE_KEYS.CONFIG, newConfig);
    set({ config: newConfig });
  },

  setApiKey: (provider, key) => {
    const newKeys = { ...get().apiKeys, [provider]: key };
    saveToStorage(STORAGE_KEYS.API_KEYS, newKeys);
    set({ apiKeys: newKeys });
  },

  removeApiKey: (provider) => {
    const newKeys = { ...get().apiKeys };
    delete newKeys[provider];
    saveToStorage(STORAGE_KEYS.API_KEYS, newKeys);
    set({ apiKeys: newKeys });
  },

  loadApiKeys: (keys) => {
    saveToStorage(STORAGE_KEYS.API_KEYS, keys);
    set({ apiKeys: keys });
  },

  addToolActivity: (activity) =>
    set((s) => ({ toolActivity: [...s.toolActivity.slice(-50), activity] })),

  clearToolActivity: () => set({ toolActivity: [] }),

  resolveApproval: (id, decision) => {
    const callback = aiApprovalCallbacks.get(id);
    if (callback) {
      callback(decision === "approve");
      aiApprovalCallbacks.delete(id);
    }
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((a) => a.id !== id),
    }));
  },

  clearAgentSteps: () => set({ agentSteps: [], pendingApprovals: [] }),

  /**
   * Initialize: hydrate from localStorage, then auto-detect
   * Ollama models so the default model actually exists.
   */
  initializeStore: async () => {
    const { config } = get();

    if (config.provider === "local") {
      const ollamaOnline = await testOllamaConnection();
      if (ollamaOnline) {
        const models = await getOllamaModels();
        if (models.length > 0 && (config.model === "auto" || !models.includes(config.model))) {
          const preferred = [
            "llama3.2:3b", "llama3.2:1b", "qwen2.5-coder:1.5b",
            "gemma2:2b", "phi3:mini", "qwen2.5-coder:7b",
            "qwen3:1.7b", "qwen3:4b", "llama3.1:8b",
            "mistral:latest", "qwen2.5-coder:latest",
          ];
          const bestModel = preferred.find((m) => models.includes(m)) || models[0];
          const newConfig = { ...config, model: bestModel };
          saveToStorage(STORAGE_KEYS.CONFIG, newConfig);
          set({ config: newConfig });
          console.log(`[Aether] Auto-selected Ollama model: ${bestModel}`);
        }
      } else {
        const { apiKeys } = get();
        if (apiKeys.groq) {
          const newConfig = { ...GROQ_FALLBACK_CONFIG };
          saveToStorage(STORAGE_KEYS.CONFIG, newConfig);
          set({ config: newConfig });
          console.log(`[Aether] Ollama offline, auto-switched to Groq fallback`);
        }
      }
    }
  },

  sendMessage: async (content: string, workspacePath?: string | null, fileContext?: string) => {
    // Prevent double-send while streaming
    if (get().isStreaming) return;

    let { config } = get();
    const { apiKeys, messages } = get();

    // Auto-fix: if using local provider, verify the model exists before sending
    if (config.provider === "local") {
      try {
        const models = await getOllamaModels();
        if (models.length > 0 && (config.model === "auto" || !models.includes(config.model))) {
          const preferred = [
            "llama3.2:3b", "llama3.2:1b", "qwen2.5-coder:1.5b",
            "gemma2:2b", "phi3:mini", "qwen2.5-coder:7b",
            "qwen3:1.7b", "qwen3:4b", "llama3.1:8b",
            "mistral:latest", "qwen2.5-coder:latest",
          ];
          const bestModel = preferred.find((m) => models.includes(m)) || models[0];
          config = { ...config, model: bestModel };
          saveToStorage(STORAGE_KEYS.CONFIG, config);
          set({ config });
          console.log(`[Aether] Auto-fixed model to: ${bestModel}`);
        } else if (models.length === 0) {
          if (apiKeys.groq) {
            config = { ...GROQ_FALLBACK_CONFIG };
            saveToStorage(STORAGE_KEYS.CONFIG, config);
            set({ config });
          } else {
            set({ error: "Ollama has no models installed. Run: ollama pull gemma2:9b" });
            return;
          }
        }
      } catch (err) {
        console.warn("[Aether] Ollama model check failed:", err);
        if (apiKeys.groq) {
          config = { ...GROQ_FALLBACK_CONFIG };
          saveToStorage(STORAGE_KEYS.CONFIG, config);
          set({ config });
        } else {
          set({ error: "Ollama is not running. Start it with: ollama serve" });
          return;
        }
      }
    }

    // Check if API key exists — local provider doesn't need one
    if (config.provider !== "local" && !apiKeys[config.provider]) {
      set({
        error: `No API key for ${config.provider}. Go to Settings (⌘ ,) → API Keys to add one.`,
      });
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    // Create placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      provider: config.provider,
      model: config.model,
      isStreaming: true,
    };

    set({
      messages: [...messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null,
      toolActivity: [],
      agentSteps: [],
    });

    try {
      let activeConfig = config;

      // Graceful fallback: if using local (Ollama), check if it's reachable first
      if (config.provider === "local") {
        const ollamaOnline = await testOllamaConnection();
        if (!ollamaOnline) {
          if (apiKeys.groq) {
            activeConfig = { ...GROQ_FALLBACK_CONFIG };
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: "*[Ollama offline — using Groq as fallback]*\n\n" }
                  : m
              ),
            }));
          } else {
            throw new Error(
              "Ollama is not running. Start it with `ollama serve` and pull a model with `ollama pull gemma2:9b`. " +
              "Or add a Groq API key in Settings for instant cloud fallback (free tier available)."
            );
          }
        }
      }

      // Fetch workspace context: directory tree + tech stack
      let workspaceTree = "";
      let techStack = "";
      if (workspacePath) {
        try {
          [workspaceTree, techStack] = await Promise.all([
            getWorkspaceTree(workspacePath),
            detectTechStack(workspacePath),
          ]);
        } catch { /* non-critical */ }
      }

      // Build the model
      const model = createChatModel(activeConfig, apiKeys);

      // Create direct tools for the AI (read/write/run/search)
      // Pass workspacePath so ALL tools resolve relative paths → absolute
      const directTools = createAgentTools("supervisor" as any, async (_approval) => {
        // Auto-approve for direct AI tool calls
        return true;
      }, (output) => {
        get().addToolActivity(output);
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: m.content + `\n> 🔧 ${output}\n` }
              : m
          ),
        }));
      }, workspacePath);

      // Create the delegate_to_agents tool for smart routing to 8-agent team
      const delegateTool = tool(
        async ({ task }: { task: string }) => {
          get().addToolActivity("🤖 Delegating to agent team...");

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + "\n\n> 🤖 **Delegating to 8-agent specialist team...**\n" }
                : m
            ),
          }));

          try {
            const result = await runAgentWorkflow(
              task,
              activeConfig,
              apiKeys,
              // Step callback — streams agent progress into inline UI
              (step) => {
                set((s) => {
                  const existingIdx = s.agentSteps.findIndex((st) => st.id === step.id);
                  const newSteps = existingIdx >= 0
                    ? s.agentSteps.map((st, i) => (i === existingIdx ? step : st))
                    : [...s.agentSteps, step];
                  return { agentSteps: newSteps };
                });
                get().addToolActivity(`${step.action}`);
              },
              // Auto-approve all agent actions (no human intervention)
              async (approval) => {
                get().addToolActivity(`✅ Auto-approved: ${approval.action}`);
                return true;
              },
              workspacePath,
              fileContext
            );

            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content + "\n> ✅ **Agent team completed task**\n" }
                  : m
              ),
            }));

            return result;
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return `Agent team error: ${error}`;
          }
        },
        {
          name: "delegate_to_agents",
          description:
            "Delegate to the agent team ONLY for complex tasks involving 5+ files or entire new systems. Do NOT use for simple tasks like UI changes, bug fixes, or editing 1-2 files — handle those directly with read_file/write_file/patch_file yourself.",
          schema: z.object({
            task: z.string().describe("Clear, specific task description for the agent team to execute"),
          }),
        }
      );

      // Helper: run simple streaming mode (no tools)
      const runSimpleStreaming = async (prefix?: string) => {
        const systemPrompt = buildSystemPrompt(workspacePath, fileContext, workspaceTree, activeConfig.provider === "local", techStack);
        const allMessages = [...messages, userMessage];

        if (prefix) {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: prefix }
                : m
            ),
          }));
        }

        await streamChat(
          activeConfig,
          apiKeys,
          allMessages,
          (chunk) => {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: m.content + chunk }
                  : m
              ),
            }));
          },
          systemPrompt
        );

        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, isStreaming: false }
              : m
          ),
          isStreaming: false,
        }));
      };

      // Local gets 6 core tools (for CPU users), cloud gets all tools + agents
      const isLocal = activeConfig.provider === "local";
      const coreToolNames = ["read_file", "write_file", "delete_file", "patch_file", "run_command", "list_directory"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localTools = [...directTools.filter((t: any) => coreToolNames.includes(t.name)), delegateTool] as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTools = isLocal ? localTools : [...directTools, delegateTool] as any[];

      // Try to bind tools — if model supports it, use tool-calling mode
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let modelWithTools: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modelWithTools = (model as any).bindTools?.(allTools) || null;
      } catch { /* model doesn't support tools */ }

      if (modelWithTools) {
        // Tool-calling mode: works for both local + cloud
        // Local uses Tauri HTTP plugin fetch (no WebKit 60s timeout)
        // If it fails, falls back to simple streaming
        try {
          const systemPrompt = buildSystemPrompt(workspacePath, fileContext, workspaceTree, isLocal, techStack);
          const langChainMessages: BaseMessage[] = [
            new SystemMessage(systemPrompt),
          ];

          // Truncate history: local=4 msgs/600 chars, cloud=6 msgs/800 chars
          const historySlice = isLocal ? messages.slice(-4) : messages.slice(-6);
          const maxChars = isLocal ? 600 : 800;
          for (const msg of historySlice) {
            const truncated = msg.content.length > maxChars
              ? msg.content.slice(0, maxChars) + "...(truncated)"
              : msg.content;
            if (msg.role === "user") {
              langChainMessages.push(new HumanMessage(truncated));
            } else if (msg.role === "assistant" && !msg.isStreaming) {
              langChainMessages.push(new AIMessage(truncated));
            }
          }
          langChainMessages.push(new HumanMessage(content));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolMap = new Map<string, any>(allTools.map((t: any) => [t.name, t]));
          // Retry helper for rate limit errors (429)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invokeRetry = async (m: any, msgs: any[]) => {
            for (let attempt = 0; attempt < 3; attempt++) {
              try { return await m.invoke(msgs); } catch (err: any) {
                const msg = err?.message || String(err);
                if ((msg.includes("429") || msg.includes("rate limit") || msg.includes("Rate limit")) && attempt < 2) {
                  get().addToolActivity(`⏳ Rate limited — retrying in ${(attempt + 1) * 3}s...`);
                  await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
                  continue;
                }
                throw err;
              }
            }
          };

          let currentMessages = [...langChainMessages];
          let iterations = 0;
          const MAX_ITERATIONS = isLocal ? 5 : 10;

          while (iterations < MAX_ITERATIONS) {
            iterations++;
            const response = await invokeRetry(modelWithTools, currentMessages);
            currentMessages.push(response);

            const toolCalls = response.tool_calls;
            if (!toolCalls || toolCalls.length === 0) {
              // Final response — update the message
              const result = typeof response.content === "string"
                ? response.content
                : JSON.stringify(response.content);

              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: m.content + result, isStreaming: false }
                    : m
                ),
                isStreaming: false,
              }));
              return;
            }

            // Execute tool calls
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

              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

          // Max iterations — get final response
          const finalResponse = await model.invoke(currentMessages);
          const finalContent = typeof finalResponse.content === "string"
            ? finalResponse.content
            : JSON.stringify(finalResponse.content);

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: m.content + finalContent, isStreaming: false }
                : m
            ),
            isStreaming: false,
          }));
        } catch (toolError) {
          // Tool-calling mode failed (likely Ollama 500 error or model doesn't support tools)
          // Gracefully fall back to simple streaming mode
          console.warn("[Aether] Tool-calling mode failed, falling back to simple streaming:", toolError);
          await runSimpleStreaming("*[Tool mode unavailable — using direct chat]*\n\n");
        }
      } else {
        // ── Simple streaming mode (model doesn't support tools) ──
        await runSimpleStreaming();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `Error: ${errorMessage}`, isStreaming: false }
            : m
        ),
        isStreaming: false,
        error: errorMessage,
      }));
    }
  },

  clearMessages: () => set({ messages: [], toolActivity: [], agentSteps: [], pendingApprovals: [] }),

  clearError: () => set({ error: null }),
}));
