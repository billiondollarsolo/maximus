import {
  mergeCapabilities,
  parseCapabilities,
  type ModelCapabilities,
} from "./model-capabilities.js";

export type ModelDefaults = {
  contextWindow?: number;
  maxOutputTokens?: number;
  numCtx?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
};

export function parseModelDefaults(
  raw: unknown,
): ModelDefaults {
  if (!raw || typeof raw !== "object") return {};
  return parseCapabilities(raw as Record<string, unknown>);
}

/**
 * Resolve effective inference params.
 * Layers (later wins): codeDefaults → orgDefaults → offering → conversationOverride
 */
export function resolveEffectiveParams(input: {
  codeDefaults?: Partial<ModelCapabilities>;
  orgDefaults?: Partial<ModelCapabilities> | null;
  offering?: Partial<ModelCapabilities> | Record<string, unknown> | null;
  conversationOverride?: Partial<ModelCapabilities> | null;
}): ModelCapabilities {
  const offering =
    input.offering && typeof input.offering === "object"
      ? parseCapabilities(input.offering as Record<string, unknown>)
      : {};
  return mergeCapabilities(
    { streaming: true, maxOutputTokens: 4096 },
    input.codeDefaults,
    input.orgDefaults,
    offering,
    input.conversationOverride,
  );
}

/** Select first accessible model ref for a new chat. */
export function pickDefaultModelRef(input: {
  defaultModelRefs?: string[] | null;
  pinnedModelRefs?: string[] | null;
  catalogRefs: string[];
}): string | null {
  const accessible = new Set(input.catalogRefs);
  for (const ref of input.defaultModelRefs ?? []) {
    if (accessible.has(ref)) return ref;
  }
  for (const ref of input.pinnedModelRefs ?? []) {
    if (accessible.has(ref)) return ref;
  }
  return input.catalogRefs[0] ?? null;
}
