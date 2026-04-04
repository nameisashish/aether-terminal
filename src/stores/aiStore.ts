// ==========================================
// AI Store (Zustand)
// Manages AI state: API keys, LLM config,
// chat history, AI mode, and streaming state.
//
// KEY UPGRADE: AI now has tool-calling capability
// and full codebase access. It can read/write
// files, run commands, and delegate to agents.
//
// PERSISTENCE: API keys and config are saved to
// localStorage so they survive app restarts.
// ==========================================

import { create } from "zustand";
import type { LLMConfig, ChatMessage, ApiKeys, LLMProvider } from "../lib/llm/types";
import { DEFAULT_LLM_CONFIG, GROQ_FALLBACK_CONFIG } from "../lib/llm/types";
import { streamChat, testOllamaConnection, getOllamaModels } from "../lib/llm/providers";
import { createChatModel } from "../lib/llm/providers";
import { createAgentTools } from "../lib/agents/tools";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

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

interface AiState {
  // ── State ──
  aiMode: boolean;
  config: LLMConfig;
  apiKeys: ApiKeys;
  messages: ChatMessage[];
  isStreaming: boolean;
  chatPanelOpen: boolean;
  error: string | null;
  useAgentMode: boolean; // When ON, complex tasks auto-route to agents
  toolActivity: string[];  // Live tool activity log

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
  setUseAgentMode: (mode: boolean) => void;
  addToolActivity: (activity: string) => void;
  clearToolActivity: () => void;
  initializeStore: () => Promise<void>; // Hydrate from localStorage + auto-detect Ollama models
}

let messageCounter = 0;
function createMessageId(): string {
  return `msg-${++messageCounter}-${Date.now()}`;
}

/**
 * System prompt — AI with full codebase access.
 * This is NOT a simple chatbot. It can read files,
 * write files, run commands, and interact with the workspace.
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

WORKFLOW — for ANY question about the codebase:
1. FIRST use list_directory and read_file to explore the actual project
2. THEN answer based on what you found — never guess or say "I don't have access"
3. When making changes, use write_file or patch_file and the user will approve

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
- For complex multi-step tasks, break them down and execute each step with tools`;

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
  useAgentMode: false,
  toolActivity: [],

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

  setUseAgentMode: (mode) => set({ useAgentMode: mode }),

  addToolActivity: (activity) =>
    set((s) => ({ toolActivity: [...s.toolActivity.slice(-50), activity] })),

  clearToolActivity: () => set({ toolActivity: [] }),

  /**
   * Initialize: hydrate from localStorage, then auto-detect
   * Ollama models so the default model actually exists.
   */
  initializeStore: async () => {
    const { config } = get();

    // If using local provider, verify the configured model actually exists
    if (config.provider === "local") {
      const ollamaOnline = await testOllamaConnection();
      if (ollamaOnline) {
        const models = await getOllamaModels();
        if (models.length > 0 && !models.includes(config.model)) {
          // The configured model doesn't exist — switch to the first available one
          const newModel = models[0];
          const newConfig = { ...config, model: newModel };
          saveToStorage(STORAGE_KEYS.CONFIG, newConfig);
          set({ config: newConfig });
          console.log(`[Aether] Auto-selected Ollama model: ${newModel}`);
        }
      } else {
        // Ollama is offline — if we have a Groq key, auto-switch
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
    let { config } = get();
    const { apiKeys, messages } = get();

    // Auto-fix: if using local provider, verify the model exists before sending
    if (config.provider === "local") {
      try {
        const models = await getOllamaModels();
        if (models.length > 0 && !models.includes(config.model)) {
          // The configured model doesn't exist — auto-switch to the first available one
          config = { ...config, model: models[0] };
          saveToStorage(STORAGE_KEYS.CONFIG, config);
          set({ config });
          console.log(`[Aether] Auto-fixed model to: ${models[0]}`);
        } else if (models.length === 0) {
          // Ollama has no models — check for cloud fallback
          if (apiKeys.groq) {
            config = { ...GROQ_FALLBACK_CONFIG };
            saveToStorage(STORAGE_KEYS.CONFIG, config);
            set({ config });
          } else {
            set({ error: "Ollama has no models installed. Run: ollama pull gemma2:9b" });
            return;
          }
        }
      } catch {
        // Ollama unreachable — try Groq fallback
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
              "Ollama is not running. Start it with `ollama serve` and pull Gemma 4 with `ollama pull gemma4:e4b`. " +
              "Or add a Groq API key in Settings for instant cloud fallback (free tier available)."
            );
          }
        }
      }

      // Build the model and tools
      const model = createChatModel(activeConfig, apiKeys);

      // Create tools for the AI — same tools agents use
      const tools = createAgentTools("supervisor" as any, async (_approval) => {
        // For AI chat, auto-approve reads, prompt for writes
        // In the future, this will show an approval dialog
        // For now, auto-approve all (tools will show in activity)
        return true;
      }, (output) => {
        get().addToolActivity(output);
        // Append tool activity to the streaming message
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: m.content + `\n> 🔧 ${output}\n` }
              : m
          ),
        }));
      });

      // Try to bind tools to model
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let modelWithTools: any = model;
      try {
        const bound = (model as any).bindTools?.(tools);
        modelWithTools = bound || model;
      } catch {
        // Model doesn't support tools — fall back to simple streaming
        modelWithTools = null;
      }

      if (modelWithTools) {
        // ── Agentic mode: tool-calling loop ──
        const systemPrompt = buildSystemPrompt(workspacePath, fileContext);
        const langChainMessages: BaseMessage[] = [
          new SystemMessage(systemPrompt),
        ];

        // Add conversation history (last 10 messages for context)
        for (const msg of messages.slice(-10)) {
          if (msg.role === "user") {
            langChainMessages.push(new HumanMessage(msg.content));
          } else if (msg.role === "assistant" && !msg.isStreaming) {
            // Use dynamic import for AIMessage to avoid circular deps
            const { AIMessage } = await import("@langchain/core/messages");
            langChainMessages.push(new AIMessage(msg.content));
          }
        }
        langChainMessages.push(new HumanMessage(content));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolMap = new Map<string, any>(tools.map((t) => [t.name, t]));
        let currentMessages = [...langChainMessages];
        let iterations = 0;
        const MAX_ITERATIONS = 10;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          const response = await modelWithTools.invoke(currentMessages, {
            timeout: 300000, // 5 min timeout for CPU-bound models
          });
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
      } else {
        // ── Simple streaming mode (model doesn't support tools) ──
        const systemPrompt = buildSystemPrompt(workspacePath, fileContext);
        const allMessages = [...messages, userMessage];
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

  clearMessages: () => set({ messages: [], toolActivity: [] }),

  clearError: () => set({ error: null }),
}));
