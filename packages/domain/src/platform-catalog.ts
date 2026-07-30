import type { CatalogModel } from "./models-for-user.js";

export type PlatformCatalogEnv = {
  /**
   * Provider transport mode (fake adapter vs live HTTP).
   * Does **not** inject demo models — catalog is keys/org only.
   */
  providerMode: "fake" | "live";
  /** OPENAI_API_KEY present */
  openai?: boolean;
  /** ANTHROPIC_API_KEY present */
  anthropic?: boolean;
  /**
   * OLLAMA_BASE_URL present (or equivalent).
   * Static Ollama rows are never emitted — register org models or use admin list_tags.
   */
  ollamaBaseUrl?: boolean;
};

const OPENAI_GPT: CatalogModel = {
  modelRef: "openai:platform:gpt-4.1",
  displayName: "GPT-4.1",
  providerKind: "openai",
  isEnabled: true,
  capabilities: {
    streaming: true,
    vision: true,
    tools: true,
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
  },
  sortOrder: 10,
};

const ANTHROPIC_SONNET: CatalogModel = {
  modelRef: "anthropic:platform:claude-sonnet-4",
  displayName: "Claude Sonnet 4",
  providerKind: "anthropic",
  isEnabled: true,
  capabilities: {
    streaming: true,
    vision: true,
    tools: true,
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
  },
  sortOrder: 20,
};

const OPENAI_IMAGE: CatalogModel = {
  modelRef: "openai:platform:gpt-image-1",
  displayName: "GPT Image (gen)",
  providerKind: "openai",
  isEnabled: true,
  capabilities: {
    streaming: false,
    imageGen: true,
    // Image models don't use chat context the same way
    maxOutputTokens: 4_096,
  },
  sortOrder: 30,
};

/** Full static platform seed (ignores keys) — for capability lookup by modelRef. */
export function platformSeedModels(): CatalogModel[] {
  return [OPENAI_GPT, OPENAI_IMAGE, ANTHROPIC_SONNET];
}

/**
 * Static **cloud** platform models — only when platform API keys exist.
 * No demo/fake injection: empty keys ⇒ empty platform catalog.
 * Ollama is never static (use org models from Admin → Providers).
 */
export function defaultPlatformCatalog(
  env: PlatformCatalogEnv = { providerMode: "live" },
): CatalogModel[] {
  const out: CatalogModel[] = [];

  if (env.openai) {
    out.push(OPENAI_GPT, OPENAI_IMAGE);
  }
  if (env.anthropic) {
    out.push(ANTHROPIC_SONNET);
  }

  return out;
}

/**
 * Build catalog rows for discovered Ollama model names.
 * Used by admin import/picker — **not** auto-merged into the chat catalog.
 * modelId may include tags (`llama3.2:latest`) — model-ref allows colons in modelId.
 */
export function ollamaDiscoveredCatalog(input: {
  modelNames: string[];
  /** `platform` for env OLLAMA_BASE_URL, else connection id */
  connectionId: string;
  /** sort base so discovered models sit after cloud platform */
  sortOrderBase?: number;
}): CatalogModel[] {
  const base = input.sortOrderBase ?? 100;
  const seen = new Set<string>();
  const rows: CatalogModel[] = [];
  let i = 0;
  for (const raw of input.modelNames) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    rows.push({
      modelRef: `ollama:${input.connectionId}:${name}`,
      displayName: formatOllamaDisplayName(name),
      providerKind: "ollama",
      isEnabled: true,
      capabilities: { streaming: true },
      sortOrder: base + i,
    });
    i += 1;
  }
  return rows;
}

/**
 * Human label for an Ollama tag.
 * Keep the **full** tag (including size/quant), e.g. `gemma3:4b`, `qwen2.5:1.5b`,
 * `llama3.2:latest` — never strip to just `4b` or `latest`. Variants must stay distinct.
 */
export function formatOllamaDisplayName(name: string): string {
  return name.trim();
}

/**
 * First enabled static platform model ref for fallbacks.
 * Prefer passing the full resolved catalog from GET /api/models instead.
 */
export function defaultPlatformModelRef(
  env: PlatformCatalogEnv = { providerMode: "live" },
): string {
  const catalog = defaultPlatformCatalog(env);
  const enabled = catalog.find((m) => m.isEnabled);
  if (enabled) return enabled.modelRef;
  // Empty catalog — stable placeholder; chat resolves real list from API.
  return "openai:platform:gpt-4.1";
}
