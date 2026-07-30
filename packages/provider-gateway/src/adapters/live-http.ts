import type { ModelCapabilities, ProviderKind } from "@maximus/domain";
import { buildProviderInferenceFields } from "../build-provider-body.js";
import {
  toAnthropicUserContent,
  toOllamaMessage,
  toOpenAiChatMessages,
  type ProviderMessage,
} from "../provider-messages.js";
import type {
  FakeChunk,
  FakeTextAdapter,
  StreamOpts,
} from "./fake-adapter.js";

export type LiveAdapterConfig = {
  providerKind: ProviderKind;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxOutputTokens?: number;
  numCtx?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
};

function capsFromOpts(cfg: LiveAdapterConfig, opts: StreamOpts): ModelCapabilities {
  return {
    maxOutputTokens: opts.maxOutputTokens ?? cfg.maxOutputTokens,
    numCtx: opts.numCtx ?? cfg.numCtx,
    temperature: opts.temperature ?? cfg.temperature,
    topP: opts.topP ?? cfg.topP,
    topK: opts.topK ?? cfg.topK,
    frequencyPenalty: opts.frequencyPenalty ?? cfg.frequencyPenalty,
    presencePenalty: opts.presencePenalty ?? cfg.presencePenalty,
    stop: opts.stop ?? cfg.stop,
  };
}

/**
 * Real multi-provider streaming via HTTP (OpenAI-compat, Anthropic, Ollama).
 * Accepts multimodal ProviderMessage[] for vision.
 */
export function createLiveHttpAdapter(cfg: LiveAdapterConfig): FakeTextAdapter {
  return {
    kind: "fake",
    modelId: cfg.modelId,
    async *stream(messages, opts) {
      const streamOpts: StreamOpts = {
        signal: opts?.signal,
        maxOutputTokens: opts?.maxOutputTokens ?? cfg.maxOutputTokens,
        numCtx: opts?.numCtx ?? cfg.numCtx,
        temperature: opts?.temperature ?? cfg.temperature,
        topP: opts?.topP ?? cfg.topP,
        topK: opts?.topK ?? cfg.topK,
        frequencyPenalty: opts?.frequencyPenalty ?? cfg.frequencyPenalty,
        presencePenalty: opts?.presencePenalty ?? cfg.presencePenalty,
        stop: opts?.stop ?? cfg.stop,
      };
      if (cfg.providerKind === "anthropic") {
        yield* streamAnthropic(cfg, messages, streamOpts);
        return;
      }
      if (cfg.providerKind === "ollama") {
        yield* streamOllama(cfg, messages, streamOpts);
        return;
      }
      yield* streamOpenAICompat(cfg, messages, streamOpts);
    },
  };
}

async function* streamOpenAICompat(
  cfg: LiveAdapterConfig,
  messages: ProviderMessage[],
  opts: StreamOpts,
): AsyncGenerator<FakeChunk> {
  const fetchFn = cfg.fetchImpl ?? fetch;
  const base = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const url = base.endsWith("/chat/completions")
    ? base
    : `${base}/chat/completions`;
  const fields = buildProviderInferenceFields(
    cfg.providerKind,
    capsFromOpts(cfg, opts),
  );
  const body: Record<string, unknown> = {
    model: cfg.modelId,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOpenAiChatMessages(messages),
    ...fields,
  };
  delete body.options;
  const res = await fetchFn(url, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI-compat error ${res.status}: ${t.slice(0, 200)}`);
  }
  yield* parseSSEOpenAI(res.body, opts.signal);
}

async function* streamAnthropic(
  cfg: LiveAdapterConfig,
  messages: ProviderMessage[],
  opts: StreamOpts,
): AsyncGenerator<FakeChunk> {
  const fetchFn = cfg.fetchImpl ?? fetch;
  const base = (cfg.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n"),
    );
  const system = systemParts.join("\n");
  const chatMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: toAnthropicUserContent(m.content),
    }));
  const fields = buildProviderInferenceFields("anthropic", capsFromOpts(cfg, opts));
  const res = await fetchFn(`${base}/v1/messages`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {}),
    },
    body: JSON.stringify({
      model: cfg.modelId,
      stream: true,
      system: system || undefined,
      messages: chatMsgs,
      max_tokens: fields.max_tokens ?? 4096,
      ...(fields.temperature != null ? { temperature: fields.temperature } : {}),
      ...(fields.top_p != null ? { top_p: fields.top_p } : {}),
      ...(fields.stop ? { stop_sequences: fields.stop } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 200)}`);
  }
  yield* parseSSEAnthropic(res.body, opts.signal);
}

async function* streamOllama(
  cfg: LiveAdapterConfig,
  messages: ProviderMessage[],
  opts: StreamOpts,
): AsyncGenerator<FakeChunk> {
  const fetchFn = cfg.fetchImpl ?? fetch;
  const base = (cfg.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const fields = buildProviderInferenceFields("ollama", capsFromOpts(cfg, opts));
  const res = await fetchFn(`${base}/api/chat`, {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelId,
      stream: true,
      messages: messages.map(toOllamaMessage),
      ...(fields.options ? { options: fields.options } : {}),
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
    if (opts.signal?.aborted) {
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
