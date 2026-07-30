import type { ModelCapabilities } from "@maximus/domain";
import {
  effectiveMaxOutputTokens,
  effectiveNumCtx,
} from "@maximus/domain";
import type { ProviderKind } from "@maximus/domain";

/**
 * Pure mapper: effective model params → provider request body fields.
 * Used by live adapters and unit tests (no network).
 */
export function buildProviderInferenceFields(
  kind: ProviderKind | "openai_compatible",
  caps: ModelCapabilities,
): {
  /** OpenAI-compat / Anthropic top-level */
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  /** Ollama options bag */
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
  return {
    ...(maxOut != null ? { max_tokens: maxOut } : {}),
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
