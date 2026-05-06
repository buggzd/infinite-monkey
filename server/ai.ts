import { estimateTokens } from "./random.js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompletionResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type CompletionOptions = {
  baseUrl: string;
  apiKey?: string;
  model: string;
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

export async function createCompletion(options: CompletionOptions): Promise<CompletionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    let payload: unknown = {};

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const detail = rawText ? `: ${rawText.slice(0, 500)}` : "";
      throw new Error(`cc-switch request failed (${response.status})${detail}`);
    }

    const text = parseCompletionText(payload);
    if (!text) {
      throw new Error("cc-switch returned no poem text");
    }

    const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
    const promptTokens = usage?.prompt_tokens ?? estimateTokens(options.messages.map((message) => message.content).join("\n"));
    const completionTokens = usage?.completion_tokens ?? estimateTokens(text);

    return {
      text,
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + completionTokens
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("cc-switch request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
