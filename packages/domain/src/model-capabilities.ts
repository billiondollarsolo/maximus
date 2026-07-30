export type ModelCapabilities = {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
  /** Non-chat embedding models — excluded from default chat picker. */
  embedding?: boolean;
  /** Max input context the model supports (tokens). */
  contextWindow?: number;
  /** Cap on completion tokens. */
  maxOutputTokens?: number;
  /** Ollama num_ctx; defaults to contextWindow when unset. */
  numCtx?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
};

function positiveInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return undefined;
}

function finiteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseStop(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

export function parseCapabilities(
  raw: Record<string, unknown> | null | undefined,
): ModelCapabilities {
  if (!raw || typeof raw !== "object") {
    return { streaming: true };
  }
  const contextWindow = positiveInt(raw.contextWindow ?? raw.context_window);
  const maxOutputTokens = positiveInt(
    raw.maxOutputTokens ?? raw.max_output_tokens ?? raw.max_tokens,
  );
  const numCtx = positiveInt(raw.numCtx ?? raw.num_ctx);
  const temperature = finiteNumber(raw.temperature);
  const topP = finiteNumber(raw.topP ?? raw.top_p);
  const topK = positiveInt(raw.topK ?? raw.top_k);
  const frequencyPenalty = finiteNumber(
    raw.frequencyPenalty ?? raw.frequency_penalty,
  );
  const presencePenalty = finiteNumber(
    raw.presencePenalty ?? raw.presence_penalty,
  );
  const stop = parseStop(raw.stop);
  return {
    streaming: raw.streaming !== false,
    vision: raw.vision === true,
    imageGen: raw.imageGen === true || raw.image_gen === true,
    tools: raw.tools === true,
    embedding:
      raw.embedding === true ||
      raw.modality === "embed" ||
      raw.modality === "embedding",
    ...(contextWindow != null ? { contextWindow } : {}),
    ...(maxOutputTokens != null ? { maxOutputTokens } : {}),
    ...(numCtx != null ? { numCtx } : {}),
    ...(temperature != null ? { temperature } : {}),
    ...(topP != null ? { topP } : {}),
    ...(topK != null ? { topK } : {}),
    ...(frequencyPenalty != null ? { frequencyPenalty } : {}),
    ...(presencePenalty != null ? { presencePenalty } : {}),
    ...(stop ? { stop } : {}),
  };
}

export function effectiveNumCtx(caps: ModelCapabilities): number | undefined {
  return caps.numCtx ?? caps.contextWindow;
}

export function effectiveMaxOutputTokens(
  caps: ModelCapabilities,
  fallback = 4096,
): number {
  return caps.maxOutputTokens ?? fallback;
}

export function modelAcceptsImages(caps: ModelCapabilities): boolean {
  return caps.vision === true;
}

export function modelCanGenerateImages(caps: ModelCapabilities): boolean {
  return caps.imageGen === true;
}

export function contentHasImages(parts: Array<{ type: string }>): boolean {
  return parts.some((p) => p.type === "image");
}

export function isEmbeddingCapability(caps: ModelCapabilities): boolean {
  return caps.embedding === true;
}

/**
 * Merge capability layers: later wins for defined keys.
 * Order of args: codeDefaults, orgDefaults, offering, conversationOverride.
 */
export function mergeCapabilities(
  ...layers: Array<Partial<ModelCapabilities> | null | undefined>
): ModelCapabilities {
  let acc: ModelCapabilities = { streaming: true };
  for (const layer of layers) {
    if (!layer) continue;
    const next = { ...acc };
    for (const [k, v] of Object.entries(layer) as Array<
      [keyof ModelCapabilities, ModelCapabilities[keyof ModelCapabilities]]
    >) {
      if (v !== undefined && v !== null) {
        (next as Record<string, unknown>)[k] = v;
      }
    }
    acc = next;
  }
  return acc;
}

export function buildCapabilities(input: {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
  embedding?: boolean;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  numCtx?: number | null;
  temperature?: number | null;
  topP?: number | null;
  topK?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  stop?: string[] | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    streaming: input.streaming !== false,
    vision: input.vision === true,
    imageGen: input.imageGen === true,
    tools: input.tools === true,
    embedding: input.embedding === true,
  };
  const cw = positiveInt(input.contextWindow ?? undefined);
  const mo = positiveInt(input.maxOutputTokens ?? undefined);
  const nc = positiveInt(input.numCtx ?? undefined);
  const temp = finiteNumber(input.temperature ?? undefined);
  const tp = finiteNumber(input.topP ?? undefined);
  const tk = positiveInt(input.topK ?? undefined);
  const fp = finiteNumber(input.frequencyPenalty ?? undefined);
  const pp = finiteNumber(input.presencePenalty ?? undefined);
  if (cw != null) out.contextWindow = cw;
  if (mo != null) out.maxOutputTokens = mo;
  if (nc != null) out.numCtx = nc;
  if (temp != null) out.temperature = temp;
  if (tp != null) out.topP = tp;
  if (tk != null) out.topK = tk;
  if (fp != null) out.frequencyPenalty = fp;
  if (pp != null) out.presencePenalty = pp;
  if (input.stop?.length) out.stop = input.stop.filter(Boolean);
  return out;
}

/** Validate sampling ranges; returns error message or null. */
export function validateSamplingParams(
  caps: Partial<ModelCapabilities>,
): string | null {
  if (caps.temperature != null && (caps.temperature < 0 || caps.temperature > 2)) {
    return "temperature must be between 0 and 2";
  }
  if (caps.topP != null && (caps.topP < 0 || caps.topP > 1)) {
    return "topP must be between 0 and 1";
  }
  if (
    caps.frequencyPenalty != null &&
    (caps.frequencyPenalty < -2 || caps.frequencyPenalty > 2)
  ) {
    return "frequencyPenalty must be between -2 and 2";
  }
  if (
    caps.presencePenalty != null &&
    (caps.presencePenalty < -2 || caps.presencePenalty > 2)
  ) {
    return "presencePenalty must be between -2 and 2";
  }
  return null;
}
