import { estimateTokens } from "./random.js";
import type { AiProtocol } from "./types.js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompletionResult = {
  text: string;
  routedModel?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type CompletionOptions = {
  baseUrl: string;
  apiKey?: string;
  protocol: AiProtocol;
  modelHint: string;
  messages: ChatMessage[];
  temperature: number;
  timeoutMs: number;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function parseCompletionText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    content?: Array<{ type?: string; text?: string }>;
    message?: { content?: string };
  };

  const choiceText = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
  if (choiceText) return choiceText.trim();

  const anthropicText = data.content
    ?.map((part) => (part.type === "text" || !part.type ? part.text : ""))
    .filter(Boolean)
    .join("\n");
  if (anthropicText) return anthropicText.trim();

  return data.message?.content?.trim() ?? "";
}

function parseJson(rawText: string) {
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    return {};
  }
}

function usageFromOpenAI(payload: unknown, messages: ChatMessage[], text: string) {
  const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
  const promptTokens = usage?.prompt_tokens ?? estimateTokens(messages.map((message) => message.content).join("\n"));
  const completionTokens = usage?.completion_tokens ?? estimateTokens(text);

  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens
  };
}

function usageFromAnthropic(payload: unknown, messages: ChatMessage[], text: string) {
  const usage = (payload as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  const promptTokens = usage?.input_tokens ?? estimateTokens(messages.map((message) => message.content).join("\n"));
  const completionTokens = usage?.output_tokens ?? estimateTokens(text);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };
}

async function requestJson(options: CompletionOptions, path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
      ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}`, "x-api-key": options.apiKey } : {})
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs)
  });
  const rawText = await response.text();
  const payload = parseJson(rawText);

  if (!response.ok) {
    const detail = rawText ? `: ${rawText.slice(0, 500)}` : "";
    throw new Error(`cc-switch ${options.protocol} request failed (${response.status})${detail}`);
  }

  return payload;
}

function splitSystemMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  return { system, conversation };
}

export async function createCompletion(options: CompletionOptions): Promise<CompletionResult> {
  try {
    if (options.protocol === "anthropic") {
      const { system, conversation } = splitSystemMessages(options.messages);
      const payload = await requestJson(
        options,
        "/messages",
        {
          model: options.modelHint,
          max_tokens: 1200,
          system,
          messages: conversation,
          temperature: options.temperature
        },
        { "anthropic-version": "2023-06-01" }
      );
      const text = parseCompletionText(payload);
      if (!text) throw new Error("cc-switch returned no poem text");

      return {
        text,
        routedModel: (payload as { model?: string }).model,
        ...usageFromAnthropic(payload, options.messages, text)
      };
    }

    const payload = await requestJson(options, "/chat/completions", {
      model: options.modelHint,
      messages: options.messages,
      temperature: options.temperature
    });
    const text = parseCompletionText(payload);
    if (!text) throw new Error("cc-switch returned no poem text");

    return {
      text,
      routedModel: (payload as { model?: string }).model,
      ...usageFromOpenAI(payload, options.messages, text)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("cc-switch request timed out");
    }
    throw error;
  }
}
