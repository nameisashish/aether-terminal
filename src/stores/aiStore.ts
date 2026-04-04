// ==========================================
// AI Store (Zustand)
// Manages AI state: API keys, LLM config,
// chat history, AI mode, and streaming state.
//
// Design: Sensible defaults for beginners
// (Groq free tier, streaming on), but fully
// configurable for power users.
// ==========================================

import { create } from "zustand";
import type { LLMConfig, ChatMessage, ApiKeys, LLMProvider } from "../lib/llm/types";
import { DEFAULT_LLM_CONFIG, GROQ_FALLBACK_CONFIG } from "../lib/llm/types";
import { streamChat, testOllamaConnection } from "../lib/llm/providers";

interface AiState {
  // ── State ──
  aiMode: boolean;
  config: LLMConfig;
  apiKeys: ApiKeys;
  messages: ChatMessage[];
  isStreaming: boolean;
  chatPanelOpen: boolean;
  error: string | null;

  // ── Actions ──
  toggleAiMode: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setConfig: (config: Partial<LLMConfig>) => void;
  setApiKey: (provider: LLMProvider, key: string) => void;
  removeApiKey: (provider: LLMProvider) => void;
  loadApiKeys: (keys: ApiKeys) => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

let messageCounter = 0;
function createMessageId(): string {
  return `msg-${++messageCounter}-${Date.now()}`;
}

/**
 * System prompt designed for dual-audience:
 * - Senior engineers get concise, no-nonsense technical answers
 * - Juniors get enough context to understand without being patronized
 */
const SYSTEM_PROMPT = `You are Aether, an AI assistant embedded in a professional terminal application built for software engineers.

Your communication style:
- Be precise and technical — but explain non-obvious concepts briefly
- When suggesting commands, always provide them in \`code blocks\`  
- Show the "why" alongside the "what" — e.g., "Use \`--no-cache\` to bypass stale layers"
- Default to the most production-grade approach (not the tutorial version)
- If a question has a simple and advanced answer, give the simple answer first, then note the advanced approach

Your capabilities:
- Code generation, debugging, refactoring, and architecture review
- Shell commands, system administration, and DevOps
- Best practices, security considerations, and performance optimization
- Explaining complex concepts with precision

Rules:
- Never produce placeholder or dummy code — every snippet should be production-ready
- If you're unsure, say so — never fabricate commands or APIs
- Respect the user's time: be concise, but never at the cost of correctness`;

export const useAiStore = create<AiState>((set, get) => ({
  aiMode: false,
  config: DEFAULT_LLM_CONFIG,
  apiKeys: {},
  messages: [],
  isStreaming: false,
  chatPanelOpen: false,
  error: null,

  toggleAiMode: () =>
    set((s) => ({ aiMode: !s.aiMode, chatPanelOpen: !s.aiMode ? true : s.chatPanelOpen })),

  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),

  removeApiKey: (provider) =>
    set((s) => {
      const newKeys = { ...s.apiKeys };
      delete newKeys[provider];
      return { apiKeys: newKeys };
    }),

  loadApiKeys: (keys) => set({ apiKeys: keys }),

  sendMessage: async (content: string) => {
    const { config, apiKeys, messages } = get();

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
    });

    try {
      let activeConfig = config;

      // Graceful fallback: if using local (Ollama), check if it's reachable first
      if (config.provider === "local") {
        const ollamaOnline = await testOllamaConnection();
        if (!ollamaOnline) {
          // Auto-switch to Groq if key exists
          if (apiKeys.groq) {
            activeConfig = { ...GROQ_FALLBACK_CONFIG };
            // Notify user about the fallback
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
        SYSTEM_PROMPT
      );

      // Mark streaming as complete
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, isStreaming: false }
            : m
        ),
        isStreaming: false,
      }));
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

  clearMessages: () => set({ messages: [] }),

  clearError: () => set({ error: null }),
}));
