// ==========================================
// LLM Types
// Type definitions for the multi-provider
// LLM system.
// ==========================================

/** Supported LLM providers */
export type LLMProvider = "groq" | "openai" | "anthropic" | "gemini" | "xai";

/** Available models per provider */
export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  groq: [
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
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
};

/** Provider display info */
export const PROVIDER_INFO: Record<LLMProvider, { name: string; color: string }> = {
  groq: { name: "Groq", color: "#f55036" },
  openai: { name: "OpenAI", color: "#10a37f" },
  anthropic: { name: "Anthropic", color: "#d4a27f" },
  gemini: { name: "Google Gemini", color: "#4285f4" },
  xai: { name: "xAI Grok", color: "#1da1f2" },
};

/** LLM configuration */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
}

/** Default configuration — Groq + Llama 3.1 70B */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "groq",
  model: "llama-3.1-70b-versatile",
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

/** API key storage format */
export type ApiKeys = Partial<Record<LLMProvider, string>>;
