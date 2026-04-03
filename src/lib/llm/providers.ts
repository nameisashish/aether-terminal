// ==========================================
// LLM Providers
// Multi-provider LLM client using LangChain.
// Supports Groq (default), OpenAI, Anthropic,
// Gemini, and xAI with streaming.
// ==========================================

import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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
  const apiKey = apiKeys[config.provider];
  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${config.provider}`);
  }

  switch (config.provider) {
    case "groq":
      return new ChatGroq({
        apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "openai":
      return new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "anthropic":
      return new ChatAnthropic({
        anthropicApiKey: apiKey,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: config.model,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        streaming: config.streaming,
      });

    case "xai":
      // xAI uses OpenAI-compatible API
      return new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        streaming: config.streaming,
        configuration: {
          baseURL: "https://api.x.ai/v1",
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
 * Tests if an API key is valid by making a minimal request
 */
export async function testApiKey(
  provider: LLMProvider,
  apiKey: string
): Promise<boolean> {
  try {
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

/** Returns the default model for a provider */
function getDefaultModel(provider: LLMProvider): string {
  const defaults: Record<LLMProvider, string> = {
    groq: "llama-3.1-70b-versatile",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-20241022",
    gemini: "gemini-2.0-flash",
    xai: "grok-2-mini",
  };
  return defaults[provider];
}
