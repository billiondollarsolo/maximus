import type { CatalogModel } from "./models-for-user.js";

export type PlatformCatalogEnv = {
  /** fake = show demo platform cloud models without requiring keys */
  providerMode: "fake" | "live";
  /** OPENAI_API_KEY present */
  openai?: boolean;
  /** ANTHROPIC_API_KEY present */
  anthropic?: boolean;
  /**
   * OLLAMA_BASE_URL present (or equivalent).
   * Static Ollama rows are never emitted — use discovery (listOllama tags).
   */
  ollamaBaseUrl?: boolean;
};

const OPENAI_GPT: CatalogModel = {
  modelRef: "openai:platform:gpt-4.1",
  displayName: "GPT-4.1",
  providerKind: "openai",
  isEnabled: true,
  capabilities: { streaming: true, vision: true, tools: true },
  sortOrder: 10,
};

const ANTHROPIC_SONNET: CatalogModel = {
  modelRef: "anthropic:platform:claude-sonnet-4",
  displayName: "Claude Sonnet 4",
  providerKind: "anthropic",
  isEnabled: true,
  capabilities: { streaming: true, vision: true, tools: true },
  sortOrder: 20,
};

const OPENAI_IMAGE: CatalogModel = {
  modelRef: "openai:platform:gpt-image-1",
  displayName: "GPT Image (gen)",
  providerKind: "openai",
  isEnabled: true,
  capabilities: { streaming: false, imageGen: true },
  sortOrder: 30,
};

/**
 * Static **cloud** platform models, gated by env / mode.
 * - **fake**: always include OpenAI + Anthropic + image (demo path).
 * - **live**: only providers with platform credentials configured.
 * - **Ollama is never static** — callers append discovery results.
 */
export function defaultPlatformCatalog(
  env: PlatformCatalogEnv = { providerMode: "fake" },
): CatalogModel[] {
  const out: CatalogModel[] = [];
  const fake = env.providerMode === "fake";

  if (fake || env.openai) {
    out.push(OPENAI_GPT, OPENAI_IMAGE);
  }
  if (fake || env.anthropic) {
    out.push(ANTHROPIC_SONNET);
  }

  return out;
}

/**
 * Build catalog rows for discovered Ollama model names.
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

function formatOllamaDisplayName(name: string): string {
  // llama3.2:latest → Llama 3.2
  const bare = name.replace(/:latest$/, "");
  return bare
    .split(/[-_]/)
    .map((p) => (p.length ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * First enabled static platform model ref for fallbacks.
 * Prefer passing the full resolved catalog from GET /api/models instead.
 */
export function defaultPlatformModelRef(
  env: PlatformCatalogEnv = { providerMode: "fake" },
): string {
  const catalog = defaultPlatformCatalog(env);
  const enabled = catalog.find((m) => m.isEnabled);
  if (enabled) return enabled.modelRef;
  // Empty live catalog — stable placeholder; chat resolves real list from API.
  return "openai:platform:gpt-4.1";
}
