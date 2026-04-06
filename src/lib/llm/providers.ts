// ==========================================
// LLM Providers
// Multi-provider LLM client using LangChain.
// Supports Local/Ollama (default), Groq,
// OpenAI, Anthropic, Gemini, xAI, OpenRouter.
// ==========================================

import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import type { LLMConfig, LLMProvider, ChatMessage, ApiKeys } from "./types";

// ── Custom Fetch for Ollama ─────────────────────
// Tauri's WebView (WebKit) has a hardcoded 60-second fetch timeout
// that cannot be changed from JavaScript. Ollama models on CPU can
// take longer than 60s for prompt evaluation (especially with tool
// schemas). This custom fetch uses Tauri's shell plugin to run curl,
// completely bypassing the WebView's timeout limitation.
// ─────────────────────────────────────────────────

/**
 * Creates a fetch-compatible function that uses curl via Tauri's shell
 * plugin instead of the browser's fetch. This bypasses WebKit's 60s
 * timeout. Falls back to browser fetch if not in a Tauri context.
 */
function createTauriFetch(): typeof fetch {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _Command: any = null;
  let _useBrowserFetch = false;

  const tauriFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    // Fall back to browser fetch if not in Tauri (e.g., dev server)
    if (_useBrowserFetch) return fetch(input, init);

    // Lazy-load Tauri shell plugin
    if (!_Command) {
      try {
        const mod = await import("@tauri-apps/plugin-shell");
        _Command = mod.Command;
      } catch {
        console.warn("[Aether] Not in Tauri context, using browser fetch");
        _useBrowserFetch = true;
        return fetch(input, init);
      }
    }

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = init?.method || "GET";
    const body = init?.body ? String(init.body) : "";

    // Build curl command with 5-minute timeout (vs WebKit's 60s)
    const curlParts = [
      "curl", "-s", "-S", "-N",
      "--max-time", "300",
      "-X", method,
      "-H", "'Content-Type: application/json'",
      "-H", "'Accept: application/json'",
    ].join(" ");

    let shellCmd: string;
    if (body) {
      // Base64-encode body to safely pass JSON through shell
      // (avoids issues with quotes, brackets, special chars)
      const b64 = btoa(unescape(encodeURIComponent(body)));
      shellCmd = `printf '%s' '${b64}' | base64 -d | ${curlParts} -d @- '${url}'`;
    } else {
      shellCmd = `${curlParts} '${url}'`;
    }

    const cmd = _Command.create("sh", ["-c", shellCmd]);
    const encoder = new TextEncoder();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let child: any = null;

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        cmd.stdout.on("data", (line: string) => {
          try {
            controller.enqueue(encoder.encode(line + "\n"));
          } catch {
            // Stream already closed
          }
        });

        cmd.stderr.on("data", (line: string) => {
          console.warn("[Aether] curl:", line);
        });

        cmd.on("close", () => {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });

        cmd.on("error", (err: string) => {
          try {
            controller.error(new Error(err));
          } catch {
            // Already closed
          }
        });

        child = await cmd.spawn();
      },
    });

    // Kill curl process if caller aborts
    if (init?.signal) {
      init.signal.addEventListener("abort", () => {
        child?.kill?.();
      });
    }

    return new Response(stream, {
      status: 200,
      statusText: "OK",
      headers: new Headers({ "Content-Type": "application/x-ndjson" }),
    });
  };

  return tauriFetch as typeof fetch;
}

/**
 * Creates a LangChain chat model instance for the given provider + config.
 * Each provider has its own LangChain integration package.
 */
export function createChatModel(
  config: LLMConfig,
  apiKeys: ApiKeys
): BaseChatModel {
  // Local provider doesn't need an API key
  if (config.provider !== "local") {
    const apiKey = apiKeys[config.provider];
    if (!apiKey) {
      throw new Error(`API key not configured for provider: ${config.provider}. Go to Settings → API Keys to add one.`);
    }
  }

  switch (config.provider) {
    case "local": {
      // Ollama runs locally — no API key needed
      // Uses custom fetch (curl via Tauri shell) to bypass WebKit's 60s timeout
      const ollamaModel = new ChatOllama({
        model: config.model,
        temperature: config.temperature,
        baseUrl: "http://localhost:11434",
        numCtx: 4096,
        keepAlive: "10m",
        numPredict: 1024,
        fetch: createTauriFetch(),
      });
      return ollamaModel;
    }

    case "groq":
      return new ChatGroq({
        apiKey: apiKeys.groq!,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "openai":
      return new ChatOpenAI({
        openAIApiKey: apiKeys.openai!,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "anthropic":
      return new ChatAnthropic({
        anthropicApiKey: apiKeys.anthropic!,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey: apiKeys.gemini!,
        model: config.model,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "xai":
      // xAI uses OpenAI-compatible API
      return new ChatOpenAI({
        openAIApiKey: apiKeys.xai!,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
        configuration: {
          baseURL: "https://api.x.ai/v1",
        },
      });

    case "openrouter":
      // OpenRouter uses OpenAI-compatible API
      return new ChatOpenAI({
        openAIApiKey: apiKeys.openrouter!,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
      });

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Converts our ChatMessage format to LangChain message objects
 */
export function toLangChainMessages(messages: ChatMessage[]) {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return new SystemMessage(msg.content);
      case "user":
        return new HumanMessage(msg.content);
      case "assistant":
        return new AIMessage(msg.content);
      default:
        return new HumanMessage(msg.content);
    }
  });
}

/**
 * Streams a response from the LLM, calling onChunk for each token.
 * Returns the complete response string.
 */
export async function streamChat(
  config: LLMConfig,
  apiKeys: ApiKeys,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  systemPrompt?: string
): Promise<string> {
  const model = createChatModel(config, apiKeys);
  const langChainMessages = toLangChainMessages(messages);

  // Prepend system prompt if provided
  if (systemPrompt) {
    langChainMessages.unshift(new SystemMessage(systemPrompt));
  }

  let fullResponse = "";

  if (config.streaming) {
    // Stream the response token by token
    const stream = await model.stream(langChainMessages);
    for await (const chunk of stream) {
      const content = typeof chunk.content === "string" ? chunk.content : "";
      fullResponse += content;
      onChunk(content);
    }
  } else {
    // Non-streaming: get the full response at once
    const response = await model.invoke(langChainMessages);
    fullResponse = typeof response.content === "string" ? response.content : "";
    onChunk(fullResponse);
  }

  return fullResponse;
}

/**
 * Tests if an API key is valid by making a minimal request.
 * For local provider, tests if Ollama is reachable.
 */
export async function testApiKey(
  provider: LLMProvider,
  apiKey: string
): Promise<boolean> {
  try {
    if (provider === "local") {
      return await testOllamaConnection();
    }

    const config: LLMConfig = {
      provider,
      model: getDefaultModel(provider),
      temperature: 0,
      maxTokens: 10,
      streaming: false,
    };

    const model = createChatModel(config, { [provider]: apiKey });
    await model.invoke([new HumanMessage("Hi")]);
    return true;
  } catch (err) {
    console.warn(`[Aether] API key test failed for ${provider}:`, err);
    return false;
  }
}

/**
 * Tests if Ollama is running and reachable at localhost:11434
 */
export async function testOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (err) {
    console.warn("[Aether] Ollama connection test failed:", err);
    return false;
  }
}

/**
 * Fetches the list of models available in the local Ollama instance
 */
export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch (err) {
    console.warn("[Aether] Failed to fetch Ollama models:", err);
    return [];
  }
}

/** Returns the default model for a provider */
function getDefaultModel(provider: LLMProvider): string {
  const defaults: Record<LLMProvider, string> = {
    local: "auto",
    groq: "llama-3.3-70b-versatile",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-20241022",
    gemini: "gemini-2.0-flash",
    xai: "grok-2-mini",
    openrouter: "meta-llama/llama-3.1-70b-instruct",
  };
  return defaults[provider];
}
