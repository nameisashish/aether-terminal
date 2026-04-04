// ==========================================
// LLM Types
// Type definitions for the multi-provider
// LLM system. Now includes local (Ollama)
// and OpenRouter support.
// ==========================================

/** Supported LLM providers */
export type LLMProvider = "local" | "groq" | "openai" | "anthropic" | "gemini" | "xai" | "openrouter";

/** Available models per provider */
export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  local: [
    "gemma4:e4b",            // Recommended — excellent balance (default)
    "gemma4:e2b",            // Lightweight — runs on 8-16GB RAM laptops
    "gemma4:26b",            // Higher quality — needs strong GPU
    "gemma4:31b",            // Highest quality — needs 24GB+ VRAM
    "gemma4:latest",         // Alias for the default variant
    "gemma3:latest",
    "llama3.1:latest",
    "codellama:latest",
    "deepseek-coder-v2:latest",
    "mistral:latest",
    "qwen2.5-coder:latest",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  xai: [
    "grok-2",
    "grok-2-mini",
  ],
  openrouter: [
    "meta-llama/llama-3.1-70b-instruct",
    "anthropic/claude-sonnet-4-20250514",
    "google/gemma-2-27b-it",
    "mistralai/mixtral-8x7b-instruct",
    "deepseek/deepseek-coder",
  ],
};

/** Provider display info */
export const PROVIDER_INFO: Record<LLMProvider, { name: string; color: string; description: string }> = {
  local: {
    name: "Local (Gemma 4)",
    color: "#34d399",
    description: "Run models locally via Ollama — free, private, no API key needed",
  },
  groq: {
    name: "Groq",
    color: "#f55036",
    description: "Ultra-fast cloud inference — free tier available",
  },
  openai: {
    name: "OpenAI",
    color: "#10a37f",
    description: "GPT-4o and GPT-4 models",
  },
  anthropic: {
    name: "Anthropic",
    color: "#d4a27f",
    description: "Claude models — strong reasoning and coding",
  },
  gemini: {
    name: "Google Gemini",
    color: "#4285f4",
    description: "Gemini 2.0 Flash and Pro models",
  },
  xai: {
    name: "xAI Grok",
    color: "#1da1f2",
    description: "Grok-2 models from xAI",
  },
  openrouter: {
    name: "OpenRouter",
    color: "#8b5cf6",
    description: "Access 100+ models via a single API key",
  },
};

/** LLM configuration */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
}

/**
 * Default configuration — Local (Gemma 4) via Ollama.
 * Falls back to Groq if Ollama is not available.
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "local",
  model: "gemma4:e4b",  // Best balance of speed + quality
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
};

/** Groq fallback config — used when Ollama is unavailable */
export const GROQ_FALLBACK_CONFIG: LLMConfig = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
};

/** Chat message */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  provider?: LLMProvider;
  model?: string;
  isStreaming?: boolean;
}

/** API key storage format — local provider doesn't need a key */
export type ApiKeys = Partial<Record<LLMProvider, string>>;
