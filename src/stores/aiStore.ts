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
 * System prompt — unified AI with direct tools + agent delegation.
 * Smart routing: simple tasks handled directly, complex tasks delegated.
 */
function buildSystemPrompt(workspacePath?: string | null, fileContext?: string): string {
  let prompt = `You are Aether, an AI coding assistant embedded in a professional terminal application. You have FULL ACCESS to the user's codebase and can perform real actions.

YOUR CAPABILITIES:
- Read any file in the workspace using read_file
- Write or create files using write_file (requires user approval)
- Modify specific parts of files using patch_file (requires user approval)
- Run shell commands (build, test, lint, git) using run_command (requires user approval)
- List directory contents using list_directory
- Search across files using search_files
- Delegate complex tasks to an 8-agent specialist team using delegate_to_agents

SMART ROUTING — choose the right approach:

DIRECT MODE (default): For questions, exploration, and simple changes.
Use your tools (read_file, write_file, patch_file, run_command, list_directory, search_files) directly.

DELEGATION MODE: For complex, multi-step tasks requiring specialized expertise.
Use delegate_to_agents to dispatch to the 8-agent team:
  Architect → system design & planning
  Coder → implementation & code changes
  Reviewer → code quality review
  Tester → test writing & validation
  QA → quality assurance & edge cases
  Documenter → documentation
  Deployer → build & deployment

WHEN TO DELEGATE:
- Feature implementation spanning multiple files
- Tasks needing code review or testing
- Refactoring or architecture changes
- When the user explicitly asks for "agent team" or "agents"
- Bug fixes requiring analysis + fix + tests + review

WHEN TO HANDLE DIRECTLY:
- Answering questions about code
- Reading/exploring files
- Simple single-file edits
- Running commands
- Quick explanations

WORKFLOW — for ANY question about the codebase:
1. FIRST use list_directory and read_file to explore the actual project
2. THEN answer based on what you found — never guess or say "I don't have access"
3. When making changes, use write_file or patch_file and the user will approve
4. For complex multi-step tasks, use delegate_to_agents

YOUR COMMUNICATION STYLE:
- Be precise and technical — explain non-obvious concepts briefly
- When suggesting commands, provide them in \`code blocks\`
- Show the "why" alongside the "what"
- Default to production-grade approaches
- Never produce placeholder or dummy code
- If you're unsure, say so — never fabricate commands or APIs

RULES:
- You ALWAYS have access to the codebase. Never say "I can't access files" or "I'm just a chatbot"
- When asked about the project, EXPLORE IT using your tools before answering
- When asked to create or modify files, USE YOUR TOOLS — don't just show code snippets
- For complex multi-step tasks, use delegate_to_agents — don't try to do everything yourself`;

  if (workspacePath) {
    prompt += `\n\nCURRENT WORKSPACE: ${workspacePath}
Start by exploring this directory when the user asks about their project.`;
  }

  if (fileContext) {
    prompt += `\n\nFILES IN CONTEXT (selected by user):\n${fileContext}`;
  }

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

      // Build the model
      const model = createChatModel(activeConfig, apiKeys);

      // Create direct tools for the AI (read/write/run/search)
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
      });

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
              // Approval callback — shows inline approval UI in chat
              (approval) => {
                return new Promise<boolean>((resolve) => {
                  aiApprovalCallbacks.set(approval.id, resolve);
                  set((s) => ({
                    pendingApprovals: [...s.pendingApprovals, approval],
                  }));
                });
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
            "Delegate a complex task to the specialized 8-agent team (Architect, Coder, Reviewer, Tester, QA, Documenter, Deployer). Use for multi-file implementations, tasks needing review/testing, refactoring, or significant code changes. The agents will explore the codebase, make changes with approval, and return comprehensive results.",
          schema: z.object({
            task: z.string().describe("Clear, specific task description for the agent team to execute"),
          }),
        }
      );

      // Combine direct tools + delegation tool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTools = [...directTools, delegateTool] as any[];

      // Try to bind tools to model
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let modelWithTools: any = model;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bound = (model as any).bindTools?.(allTools);
        modelWithTools = bound || model;
      } catch {
        // Model doesn't support tools — fall back to simple streaming
        modelWithTools = null;
      }

      // Helper: run simple streaming mode (no tools)
      const runSimpleStreaming = async (prefix?: string) => {
        const systemPrompt = buildSystemPrompt(workspacePath, fileContext);
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

      if (modelWithTools) {
        // ── Agentic mode: tool-calling loop ──
        // Wrapped in try-catch: if tool-calling causes a 500 error (common with
        // Ollama models that don't fully support function calling), we gracefully
        // fall back to simple streaming mode instead of showing an error.
        try {
          const systemPrompt = buildSystemPrompt(workspacePath, fileContext);
          const langChainMessages: BaseMessage[] = [
            new SystemMessage(systemPrompt),
          ];

          // Add conversation history (last 10 messages for context)
          for (const msg of messages.slice(-10)) {
            if (msg.role === "user") {
              langChainMessages.push(new HumanMessage(msg.content));
            } else if (msg.role === "assistant" && !msg.isStreaming) {
              langChainMessages.push(new AIMessage(msg.content));
            }
          }
          langChainMessages.push(new HumanMessage(content));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolMap = new Map<string, any>(allTools.map((t: any) => [t.name, t]));
          let currentMessages = [...langChainMessages];
          let iterations = 0;
          const MAX_ITERATIONS = 10;

          while (iterations < MAX_ITERATIONS) {
            iterations++;
            const response = await modelWithTools.invoke(currentMessages);
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
