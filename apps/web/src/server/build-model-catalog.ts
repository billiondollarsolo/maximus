import {
  composeCatalog,
  defaultPlatformCatalog,
  modelsForUser,
  ollamaDiscoveredCatalog,
  type CatalogModel,
  type OrgRole,
  type PlatformCatalogEnv,
} from "@maximus/domain";
import type { Db } from "@maximus/db";
import { providerRepo } from "@maximus/db";
import { listOllamaModels } from "@maximus/provider-gateway";
import type { serverEnv } from "#/server/env";

type Env = ReturnType<typeof serverEnv>;

export type BuildModelCatalogResult = {
  /** Full catalog before role/allowlist filter (admin views). */
  catalog: CatalogModel[];
  /** User-facing filtered list. */
  models: CatalogModel[];
  platform: CatalogModel[];
  discoveredOllama: CatalogModel[];
};

/**
 * Compose gated platform models + live Ollama discovery + org BYOK models.
 */
export async function buildModelCatalog(input: {
  db: Db;
  orgId: string;
  role: OrgRole;
  env: Env;
  /** Inject Ollama list for tests */
  listOllama?: typeof listOllamaModels;
}): Promise<BuildModelCatalogResult> {
  const listFn = input.listOllama ?? listOllamaModels;
  const envFlags: PlatformCatalogEnv = {
    providerMode: input.env.providerMode,
    openai: Boolean(input.env.openaiApiKey),
    anthropic: Boolean(input.env.anthropicApiKey),
    ollamaBaseUrl: Boolean(input.env.ollamaBaseUrl),
  };

  const staticPlatform = defaultPlatformCatalog(envFlags);

  const [orgModels, allowRows, connections] = await Promise.all([
    providerRepo.listModels(input.db, input.orgId),
    providerRepo.listAllowlist(input.db, input.orgId),
    providerRepo.listProviderConnections(input.db, input.orgId),
  ]);

  const orgCatalog: CatalogModel[] = orgModels.map((m) => ({
    modelRef: m.modelRef,
    displayName: m.displayName,
    providerKind: m.providerKind,
    isEnabled: m.isEnabled,
    capabilities: (m.capabilities ?? {}) as Record<string, unknown>,
    sortOrder: m.sortOrder,
  }));

  // Discover Ollama: platform env + each enabled Ollama BYOK connection.
  const discoverJobs: Array<Promise<CatalogModel[]>> = [];

  if (input.env.ollamaBaseUrl) {
    discoverJobs.push(
      listFn({
        baseUrl: input.env.ollamaBaseUrl,
        allowPrivateBaseUrls: input.env.allowPrivateBaseUrls,
      }).then((tags) =>
        ollamaDiscoveredCatalog({
          modelNames: tags.map((t) => t.name),
          connectionId: "platform",
          sortOrderBase: 100,
        }),
      ),
    );
  }

  const ollamaConns = connections.filter(
    (c) => c.kind === "ollama" && c.isEnabled && c.baseUrl,
  );
  for (const [idx, c] of ollamaConns.entries()) {
    discoverJobs.push(
      listFn({
        baseUrl: c.baseUrl!,
        allowPrivateBaseUrls: input.env.allowPrivateBaseUrls,
      }).then((tags) =>
        ollamaDiscoveredCatalog({
          modelNames: tags.map((t) => t.name),
          connectionId: c.id,
          sortOrderBase: 200 + idx * 50,
        }),
      ),
    );
  }

  const discoveredChunks = await Promise.all(discoverJobs);
  const discoveredOllama = discoveredChunks.flat();

  // Platform slice for admin UI = static cloud + platform-scoped ollama discovery
  const platform = [
    ...staticPlatform,
    ...discoveredOllama.filter((m) => m.modelRef.includes(":platform:")),
  ];

  // Merge: static platform + all discovered ollama + org DB models
  // Org rows override same modelRef (e.g. custom display / disable).
  const catalog = composeCatalog({
    platform: [...staticPlatform, ...discoveredOllama],
    orgModels: orgCatalog,
  });

  const allowlist = allowRows.map((r) => ({
    modelRef: r.modelRef,
    role: (r.role as "owner" | "admin" | "member" | null) ?? null,
  }));

  const models = modelsForUser(catalog, input.role, allowlist);

  return { catalog, models, platform, discoveredOllama };
}
