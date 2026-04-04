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
      // Large models on CPU can take 2-5 min for first response
      const ollamaModel = new ChatOllama({
        model: config.model,
        temperature: config.temperature,
        baseUrl: "http://localhost:11434",
        numCtx: 2048,  // Smaller context = faster + less RAM on CPU
      });
      // Override the default timeout via internal client config
      // @ts-expect-error – setting timeout on internal caller
      ollamaModel.timeout = 300000; // 5 minutes
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
  } catch {
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
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
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
  } catch {
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
