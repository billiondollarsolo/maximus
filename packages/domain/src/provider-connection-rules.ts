import type { ProviderKind } from "./model-ref.js";
import { PROVIDER_KINDS } from "./model-ref.js";

export type ConnectionRulesInput = {
  kind: string;
  apiKey?: string | null;
  baseUrl?: string | null;
};

export type ConnectionRulesResult =
  | { ok: true; kind: ProviderKind; apiKey: string; baseUrl: string | null }
  | { ok: false; error: string };

/**
 * Kind-specific validation for provider connections.
 * openai/anthropic: non-empty apiKey; baseUrl optional.
 * openai_compatible: non-empty apiKey + baseUrl required.
 * ollama: baseUrl required; apiKey may be empty.
 */
export function validateProviderConnection(
  input: ConnectionRulesInput,
): ConnectionRulesResult {
  if (!PROVIDER_KINDS.includes(input.kind as ProviderKind)) {
    return { ok: false, error: `Invalid provider kind: ${input.kind}` };
  }
  const kind = input.kind as ProviderKind;
  const baseUrl =
    input.baseUrl == null || input.baseUrl.trim() === ""
      ? null
      : input.baseUrl.trim();
  const apiKey = input.apiKey ?? "";

  if (kind === "openai" || kind === "anthropic") {
    if (!apiKey.trim()) {
      return { ok: false, error: `API key required for ${kind}` };
    }
    return { ok: true, kind, apiKey: apiKey.trim(), baseUrl };
  }

  if (kind === "openai_compatible") {
    if (!apiKey.trim()) {
      return { ok: false, error: "API key required for openai_compatible" };
    }
    if (!baseUrl) {
      return {
        ok: false,
        error: "baseUrl required for openai_compatible",
      };
    }
    return { ok: true, kind, apiKey: apiKey.trim(), baseUrl };
  }

  // ollama
  if (!baseUrl) {
    return { ok: false, error: "baseUrl required for ollama" };
  }
  return { ok: true, kind, apiKey: apiKey.trim(), baseUrl };
}

export function isProviderKind(value: string): value is ProviderKind {
  return PROVIDER_KINDS.includes(value as ProviderKind);
}
