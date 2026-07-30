import {
  composeCatalog,
  defaultPlatformCatalog,
  modelsForUser,
  type CatalogModel,
  type OrgRole,
  type PlatformCatalogEnv,
} from "@maximus/domain";
import type { Db } from "@maximus/db";
import { providerRepo } from "@maximus/db";
import type { serverEnv } from "#/server/env";

type Env = ReturnType<typeof serverEnv>;

export type BuildModelCatalogResult = {
  /** Full catalog before role/allowlist filter (admin views). */
  catalog: CatalogModel[];
  /** User-facing filtered list (chat picker). */
  models: CatalogModel[];
  /** Platform cloud models only (keys required). */
  platform: CatalogModel[];
};

/**
 * Chat / member catalog:
 * - Platform cloud models **only if** platform API keys are set
 * - Org models that are **explicitly registered** and enabled
 *
 * Does **not** auto-list every Ollama `/api/tags` entry — use Admin → Add model
 * (picker from tags) to register offerings.
 */
export async function buildModelCatalog(input: {
  db: Db;
  orgId: string;
  role: OrgRole;
  env: Env;
}): Promise<BuildModelCatalogResult> {
  const envFlags: PlatformCatalogEnv = {
    providerMode: input.env.providerMode,
    openai: Boolean(input.env.openaiApiKey),
    anthropic: Boolean(input.env.anthropicApiKey),
    ollamaBaseUrl: Boolean(input.env.ollamaBaseUrl),
  };

  const staticPlatform = defaultPlatformCatalog(envFlags);

  const [orgModels, allowRows] = await Promise.all([
    providerRepo.listModels(input.db, input.orgId),
    providerRepo.listAllowlist(input.db, input.orgId),
  ]);

  // Only models on enabled connections (or platform-style rows without connection)
  const connections = await providerRepo.listProviderConnections(
    input.db,
    input.orgId,
  );
  const enabledConnIds = new Set(
    connections.filter((c) => c.isEnabled).map((c) => c.id),
  );

  const orgCatalog: CatalogModel[] = orgModels
    .filter((m) => {
      // Platform overrides may have null connectionId
      if (!m.connectionId || m.connectionId === "platform") return true;
      return enabledConnIds.has(m.connectionId);
    })
    .map((m) => ({
      modelRef: m.modelRef,
      displayName: m.displayName,
      providerKind: m.providerKind,
      isEnabled: m.isEnabled,
      capabilities: (m.capabilities ?? {}) as Record<string, unknown>,
      sortOrder: m.sortOrder,
    }));

  const platform = staticPlatform;

  const catalog = composeCatalog({
    platform: staticPlatform,
    orgModels: orgCatalog,
  });

  const allowlist = allowRows.map((r) => ({
    modelRef: r.modelRef,
    role: (r.role as "owner" | "admin" | "member" | null) ?? null,
  }));

  const models = modelsForUser(catalog, input.role, allowlist);

  return { catalog, models, platform };
}
