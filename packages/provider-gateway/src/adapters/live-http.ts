import type { FakeChunk, FakeTextAdapter } from "./fake-adapter.js";
import type { ProviderKind } from "@maximus/domain";

export type LiveAdapterConfig = {
  providerKind: ProviderKind;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
};

/**
 * Real multi-provider streaming via HTTP (OpenAI-compat, Anthropic, Ollama).
 * Same stream interface as the fake adapter for runChatTurn.
 */
export function createLiveHttpAdapter(cfg: LiveAdapterConfig): FakeTextAdapter {
  return {
    kind: "fake", // stream-compatible surface; identity via modelId/provider
    modelId: cfg.modelId,
    async *stream(messages, opts) {
      if (cfg.providerKind === "anthropic") {
        yield* streamAnthropic(cfg, messages, opts?.signal);
        return;
      }
      if (cfg.providerKind === "ollama") {
        yield* streamOllama(cfg, messages, opts?.signal);
        return;
      }
      // openai + openai_compatible
      yield* streamOpenAICompat(cfg, messages, opts?.signal);
    },
  };
}

async function* streamOpenAICompat(
  cfg: LiveAdapterConfig,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): AsyncGenerator<FakeChunk> {
  const base = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const url = base.endsWith("/chat/completions")
    ? base
    : `${base}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.modelId,
      stream: true,
      stream_options: { include_usage: true },
      messages: messages.map((m) => ({
        role: m.role === "system" ? "system" : m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI-compat error ${res.status}: ${t.slice(0, 200)}`);
  }
  yield* parseSSEOpenAI(res.body, signal);
}

async function* streamAnthropic(
  cfg: LiveAdapterConfig,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): AsyncGenerator<FakeChunk> {
  const base = (cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const chatMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {}),
    },
    body: JSON.stringify({
      model: cfg.modelId,
      max_tokens: 4096,
      stream: true,
      system: system || undefined,
      messages: chatMsgs,
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 200)}`);
  }
  yield* parseSSEAnthropic(res.body, signal);
}

async function* streamOllama(
  cfg: LiveAdapterConfig,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): AsyncGenerator<FakeChunk> {
  const base = (cfg.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelId,
      stream: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${t.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let outTokens = 0;
  while (true) {
    if (signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        if (j.message?.content) {
          outTokens += 1;
          yield { type: "text", text: j.message.content };
        }
        if (j.done) {
          yield {
            type: "usage",
            inputTokens: j.prompt_eval_count ?? 0,
            outputTokens: j.eval_count ?? outTokens,
          };
        }
      } catch {
        // skip
      }
    }
  }
}

async function* parseSSEOpenAI(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<FakeChunk> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let inTok = 0;
  let outTok = 0;
  while (true) {
    if (signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = j.choices?.[0]?.delta?.content;
        if (text) yield { type: "text", text };
        if (j.usage) {
          inTok = j.usage.prompt_tokens ?? inTok;
          outTok = j.usage.completion_tokens ?? outTok;
        }
      } catch {
        // skip
      }
    }
  }
  if (inTok || outTok) {
    yield { type: "usage", inputTokens: inTok, outputTokens: outTok };
  }
}

async function* parseSSEAnthropic(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<FakeChunk> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let inTok = 0;
  let outTok = 0;
  while (true) {
    if (signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      try {
        const j = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string };
          usage?: { input_tokens?: number; output_tokens?: number };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
        };
        if (j.type === "content_block_delta" && j.delta?.text) {
          yield { type: "text", text: j.delta.text };
        }
        if (j.usage) {
          inTok = j.usage.input_tokens ?? inTok;
          outTok = j.usage.output_tokens ?? outTok;
        }
        if (j.message?.usage) {
          inTok = j.message.usage.input_tokens ?? inTok;
          outTok = j.message.usage.output_tokens ?? outTok;
        }
      } catch {
        // skip
      }
    }
  }
  if (inTok || outTok) {
    yield { type: "usage", inputTokens: inTok, outputTokens: outTok };
  }
}
