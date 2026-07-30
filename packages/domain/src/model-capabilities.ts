export type ModelCapabilities = {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
  /** Max input context the model supports (tokens). Used for budgeting / Ollama num_ctx. */
  contextWindow?: number;
  /** Cap on completion tokens (OpenAI max_tokens, Anthropic max_tokens, Ollama num_predict). */
  maxOutputTokens?: number;
  /**
   * Ollama load/runtime context (num_ctx). Defaults to contextWindow when unset.
   * Other providers ignore this.
   */
  numCtx?: number;
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
  return {
    streaming: raw.streaming !== false,
    vision: raw.vision === true,
    imageGen: raw.imageGen === true || raw.image_gen === true,
    tools: raw.tools === true,
    ...(contextWindow != null ? { contextWindow } : {}),
    ...(maxOutputTokens != null ? { maxOutputTokens } : {}),
    ...(numCtx != null ? { numCtx } : {}),
  };
}

/** Effective Ollama num_ctx: explicit numCtx, else contextWindow. */
export function effectiveNumCtx(caps: ModelCapabilities): number | undefined {
  return caps.numCtx ?? caps.contextWindow;
}

/** Default max output when not configured (Anthropic requires a value). */
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

/** True if content parts include at least one image. */
export function contentHasImages(
  parts: Array<{ type: string }>,
): boolean {
  return parts.some((p) => p.type === "image");
}

/**
 * Build a capabilities object for persistence from form / partials.
 * Omits undefined optionals so JSON stays clean.
 */
export function buildCapabilities(input: {
  streaming?: boolean;
  vision?: boolean;
  imageGen?: boolean;
  tools?: boolean;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  numCtx?: number | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {
    streaming: input.streaming !== false,
    vision: input.vision === true,
    imageGen: input.imageGen === true,
    tools: input.tools === true,
  };
  const cw = positiveInt(input.contextWindow ?? undefined);
  const mo = positiveInt(input.maxOutputTokens ?? undefined);
  const nc = positiveInt(input.numCtx ?? undefined);
  if (cw != null) out.contextWindow = cw;
  if (mo != null) out.maxOutputTokens = mo;
  if (nc != null) out.numCtx = nc;
  return out;
}
