import {
  composeCatalog,
  defaultPlatformCatalog,
  modelsForUser,
  pickDefaultModelRef,
  type CatalogModel,
  type OrgRole,
  type PlatformCatalogEnv,
} from "@maximus/domain";
import type { Db } from "@maximus/db";
import { agentsRepo, getOrgSettings, providerRepo } from "@maximus/db";
import type { serverEnv } from "#/server/env";

type Env = ReturnType<typeof serverEnv>;

export type AgentCatalogEntry = {
  /** Synthetic picker ref: `agent:{presetId}` */
  modelRef: string;
  displayName: string;
  baseModelRef: string;
  isEnabled: boolean;
  isVisible: boolean;
  providerKind: "agent";
};

export type BuildModelCatalogResult = {
  /** Full catalog before role/allowlist filter (admin views). */
  catalog: CatalogModel[];
  /** User-facing filtered list (chat picker). */
  models: CatalogModel[];
  /** Platform cloud models only (keys required). */
  platform: CatalogModel[];
  /** Enabled+visible agent presets for picker. */
  agents: AgentCatalogEntry[];
  /** Preferred model for new chats (defaults → pins → first). */
  defaultModelRef: string | null;
};

/**
 * Chat / member catalog:
 * - Platform cloud models **only if** platform API keys are set
 * - Org models that are **explicitly registered**, enabled, visible, non-embedding
 *
 * Does **not** auto-list every Ollama `/api/tags` entry.
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

  const [orgModels, allowRows, connections, agentRows, orgSettings] =
    await Promise.all([
      providerRepo.listModels(input.db, input.orgId),
      providerRepo.listAllowlist(input.db, input.orgId),
      providerRepo.listProviderConnections(input.db, input.orgId),
      agentsRepo.listAgentPresets(input.db, input.orgId).catch(() => []),
      getOrgSettings(input.db, input.orgId),
    ]);

  const enabledConnIds = new Set(
    connections.filter((c) => c.isEnabled).map((c) => c.id),
  );
  const connNameById = new Map(connections.map((c) => [c.id, c.name]));

  const orgCatalog: CatalogModel[] = orgModels
    .filter((m) => {
      if (!m.connectionId || m.connectionId === "platform") return true;
      return enabledConnIds.has(m.connectionId);
    })
    .map((m) => ({
      modelRef: m.modelRef,
      displayName: m.displayName,
      providerKind: m.providerKind,
      isEnabled: m.isEnabled,
      isVisible: m.isVisible ?? true,
      capabilities: (m.capabilities ?? {}) as Record<string, unknown>,
      sortOrder: m.sortOrder,
      connectionId: m.connectionId,
      connectionName: m.connectionId
        ? (connNameById.get(m.connectionId) ?? null)
        : "Platform",
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

  const agents: AgentCatalogEntry[] = (agentRows as Array<{
    id: string;
    name: string;
    baseModelRef: string;
    isEnabled: boolean;
    isVisible: boolean | null;
  }>)
    .filter((a) => a.isEnabled && a.isVisible !== false)
    .map((a) => ({
      modelRef: `agent:${a.id}`,
      displayName: a.name,
      baseModelRef: a.baseModelRef,
      isEnabled: true,
      isVisible: true,
      providerKind: "agent" as const,
    }));

  // Agents that point at inaccessible bases stay listed only if base is in chat models.
  const accessibleBases = new Set(models.map((m) => m.modelRef));
  const agentsVisible = agents.filter((a) =>
    accessibleBases.has(a.baseModelRef),
  );

  const catalogRefs = [
    ...models.map((m) => m.modelRef),
    ...agentsVisible.map((a) => a.modelRef),
  ];
  const defaultModelRef = pickDefaultModelRef({
    defaultModelRefs: Array.isArray(orgSettings.defaultModelRefs)
      ? (orgSettings.defaultModelRefs as string[])
      : [],
    pinnedModelRefs: Array.isArray(orgSettings.pinnedModelRefs)
      ? (orgSettings.pinnedModelRefs as string[])
      : [],
    catalogRefs,
  });

  return {
    catalog,
    models,
    platform,
    agents: agentsVisible,
    defaultModelRef,
  };
}
