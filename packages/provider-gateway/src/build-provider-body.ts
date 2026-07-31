import type {
  ModelCapabilities,
  OpenAiMaxTokenParam,
  ProviderKind,
} from "@maximus/domain";
import {
  effectiveMaxOutputTokens,
  effectiveNumCtx,
} from "@maximus/domain";

/**
 * Heuristic bootstrap when we have not yet learned the field for this offering.
 * Prefer stored `caps.openaiMaxTokenParam` when present.
 */
export function openaiUsesMaxCompletionTokens(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (/^o[1-9]/.test(id)) return true;
  if (id.startsWith("gpt-5") || id.includes("gpt-5")) return true;
  if (id.includes("luna")) return true;
  return false;
}

/** Resolve which max-token field to send for an OpenAI-style body. */
export function resolveOpenAiMaxTokenParam(
  caps: ModelCapabilities,
  modelId: string,
): OpenAiMaxTokenParam {
  if (
    caps.openaiMaxTokenParam === "max_tokens" ||
    caps.openaiMaxTokenParam === "max_completion_tokens"
  ) {
    return caps.openaiMaxTokenParam;
  }
  return openaiUsesMaxCompletionTokens(modelId)
    ? "max_completion_tokens"
    : "max_tokens";
}

/**
 * Pure mapper: effective model params → provider request body fields.
 * Used by live adapters and unit tests (no network).
 */
export function buildProviderInferenceFields(
  kind: ProviderKind | "openai_compatible",
  caps: ModelCapabilities,
  opts?: { modelId?: string },
): {
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  options?: Record<string, number | string | string[]>;
} {
  const maxOut = effectiveMaxOutputTokens(caps);
  const numCtx = effectiveNumCtx(caps);

  if (kind === "ollama") {
    const options: Record<string, number | string | string[]> = {};
    if (numCtx != null) options.num_ctx = numCtx;
    if (maxOut != null) options.num_predict = maxOut;
    if (caps.temperature != null) options.temperature = caps.temperature;
    if (caps.topP != null) options.top_p = caps.topP;
    if (caps.topK != null) options.top_k = caps.topK;
    if (caps.stop?.length) options.stop = caps.stop;
    return { options: Object.keys(options).length ? options : undefined };
  }

  if (kind === "anthropic") {
    return {
      max_tokens: maxOut,
      ...(caps.temperature != null ? { temperature: caps.temperature } : {}),
      ...(caps.topP != null ? { top_p: caps.topP } : {}),
      ...(caps.stop?.length ? { stop: caps.stop } : {}),
    };
  }

  // openai + openai_compatible
  const modelId = opts?.modelId ?? "";
  // Learned flag applies to openai and openai_compatible (many gateways mirror OpenAI).
  const tokenParam = resolveOpenAiMaxTokenParam(caps, modelId);

  return {
    ...(maxOut != null
      ? tokenParam === "max_completion_tokens"
        ? { max_completion_tokens: maxOut }
        : { max_tokens: maxOut }
      : {}),
    ...(caps.temperature != null ? { temperature: caps.temperature } : {}),
    ...(caps.topP != null ? { top_p: caps.topP } : {}),
    ...(caps.frequencyPenalty != null
      ? { frequency_penalty: caps.frequencyPenalty }
      : {}),
    ...(caps.presencePenalty != null
      ? { presence_penalty: caps.presencePenalty }
      : {}),
    ...(caps.stop?.length ? { stop: caps.stop } : {}),
  };
}
