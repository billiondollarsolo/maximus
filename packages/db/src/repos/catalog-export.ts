import {
  assertExportHasNoSecrets,
  parseModelRef,
  sanitizeConnectionForExport,
  serializeModelRef,
} from "@maximus/domain";
import type { Db } from "../client.js";
import * as providerRepo from "./providers.js";
import { getOrgSettings, patchOrgSettings } from "./org-settings.js";
import { createAgentPreset, listAgentPresets } from "./agents.js";
import * as prices from "./prices.js";

export type CatalogExportPayload = {
  version?: number;
  orgId?: string;
  exportedAt?: string;
  settings?: {
    modelDefaults?: Record<string, unknown> | object;
    defaultModelRefs?: string[] | unknown;
    pinnedModelRefs?: string[] | unknown;
  };
  connections?: Array<{
    id?: string;
    kind: string;
    name: string;
    baseUrl?: string | null;
    isEnabled?: boolean;
    hasCredentials?: boolean;
    credentialsEncrypted?: string;
    apiKey?: string;
    [key: string]: unknown;
  }>;
  models?: Array<{
    modelRef: string;
    modelId: string;
    displayName: string;
    providerKind: string;
    connectionId?: string | null;
    capabilities?: Record<string, unknown> | null;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
    inputUsdPer1m?: string | number | null;
    outputUsdPer1m?: string | number | null;
  }>;
  allowlist?: Array<{ modelRef: string; role?: string | null }>;
  agents?: Array<{
    name: string;
    slug: string;
    baseModelRef: string;
    systemPrompt?: string | null;
    params?: Record<string, unknown>;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
  }>;
  prices?: Array<{
    orgId?: string | null;
    providerKind: string;
    modelIdPattern: string;
    inputUsdPer1m: string | number;
    outputUsdPer1m: string | number;
  }>;
};

/**
 * Export org catalog configuration without secrets.
 */
export async function exportOrgCatalog(db: Db, orgId: string) {
  const [connections, models, allowlist, settings, agents, priceRows] =
    await Promise.all([
      providerRepo.listProviderConnections(db, orgId),
      providerRepo.listModels(db, orgId),
      providerRepo.listAllowlist(db, orgId),
      getOrgSettings(db, orgId),
      listAgentPresets(db, orgId),
      prices.listPrices(db, orgId).catch(() => []),
    ]);

  const safeConnections = connections.map((c) =>
    sanitizeConnectionForExport({
      id: c.id,
      kind: c.kind,
      name: c.name,
      baseUrl: c.baseUrl,
      isEnabled: c.isEnabled,
      credentialsEncrypted: c.credentialsEncrypted,
      credentialsMeta: c.credentialsMeta as Record<string, unknown>,
    }),
  );

  const payload = {
    version: 1,
    orgId,
    exportedAt: new Date().toISOString(),
    settings: {
      modelDefaults: settings.modelDefaults ?? {},
      defaultModelRefs: settings.defaultModelRefs ?? [],
      pinnedModelRefs: settings.pinnedModelRefs ?? [],
    },
    connections: safeConnections,
    models: models.map((m) => ({
      modelRef: m.modelRef,
      modelId: m.modelId,
      displayName: m.displayName,
      providerKind: m.providerKind,
      connectionId: m.connectionId,
      capabilities: m.capabilities,
      isEnabled: m.isEnabled,
      isVisible: m.isVisible ?? true,
      sortOrder: m.sortOrder,
      inputUsdPer1m: m.inputUsdPer1m,
      outputUsdPer1m: m.outputUsdPer1m,
    })),
    allowlist: allowlist.map((a) => ({
      modelRef: a.modelRef,
      role: a.role,
    })),
    agents: agents.map((a) => ({
      name: a.name,
      slug: a.slug,
      baseModelRef: a.baseModelRef,
      systemPrompt: a.systemPrompt,
      params: a.params,
      isEnabled: a.isEnabled,
      isVisible: a.isVisible,
      sortOrder: a.sortOrder,
    })),
    // Only org-owned prices (platform seeds have null orgId)
    prices: priceRows
      .filter((p) => p.orgId === orgId)
      .map((p) => ({
        providerKind: p.providerKind,
        modelIdPattern: p.modelIdPattern,
        inputUsdPer1m: p.inputUsdPer1m,
        outputUsdPer1m: p.outputUsdPer1m,
      })),
  };

  assertExportHasNoSecrets(payload);
  return payload;
}

function remapModelRef(
  ref: string,
  connIdMap: Map<string, string>,
): string {
  try {
    const parsed = parseModelRef(ref);
    if (parsed.connectionId === "platform") return ref;
    const nextConn = connIdMap.get(parsed.connectionId);
    if (!nextConn) return ref;
    return serializeModelRef({
      ...parsed,
      connectionId: nextConn,
    });
  } catch {
    return ref;
  }
}

export type ImportOrgCatalogResult = {
  dryRun: boolean;
  connections: { created: number; skipped: number };
  models: { created: number; skipped: number; updated: number };
  allowlist: { created: number; skipped: number };
  agents: { created: number; skipped: number };
  prices: { created: number; skipped: number };
  settingsApplied: boolean;
  /** oldConnId → newConnId */
  connectionIdMap: Record<string, string>;
};

/**
 * Import a secret-free catalog export into an org.
 * - Never writes apiKey / credentialsEncrypted from payload (always placeholder empty).
 * - Remaps connection ids in modelRef / allowlist / agents.
 * - conflict: "skip" (default) leaves existing rows; "overwrite" updates model caps/flags.
 */
export async function importOrgCatalog(
  db: Db,
  orgId: string,
  payload: CatalogExportPayload,
  opts: { dryRun?: boolean; conflict?: "skip" | "overwrite" } = {},
): Promise<ImportOrgCatalogResult> {
  assertExportHasNoSecrets(payload);

  const dryRun = opts.dryRun === true;
  const conflict = opts.conflict ?? "skip";

  const result: ImportOrgCatalogResult = {
    dryRun,
    connections: { created: 0, skipped: 0 },
    models: { created: 0, skipped: 0, updated: 0 },
    allowlist: { created: 0, skipped: 0 },
    agents: { created: 0, skipped: 0 },
    prices: { created: 0, skipped: 0 },
    settingsApplied: false,
    connectionIdMap: {},
  };

  const connIdMap = new Map<string, string>();
  const existingConns = await providerRepo.listProviderConnections(db, orgId);

  for (const c of payload.connections ?? []) {
    if (!c.kind || !c.name) continue;
    // Match existing by kind+name+baseUrl so re-import is stable.
    const match = existingConns.find(
      (e) =>
        e.kind === c.kind &&
        e.name === c.name &&
        (e.baseUrl ?? null) === (c.baseUrl ?? null),
    );
    if (match) {
      if (c.id) connIdMap.set(c.id, match.id);
      result.connections.skipped += 1;
      if (!dryRun && c.isEnabled != null && c.isEnabled !== match.isEnabled) {
        await providerRepo.updateProviderConnection(db, {
          id: match.id,
          orgId,
          isEnabled: c.isEnabled,
        });
      }
      continue;
    }
    result.connections.created += 1;
    if (dryRun) {
      if (c.id) connIdMap.set(c.id, `dryrun-${c.id}`);
      continue;
    }
    // Placeholder credentials only — secrets never restored from export.
    const row = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: c.kind,
      name: c.name,
      baseUrl: c.baseUrl ?? null,
      credentialsEncrypted: "",
      hasSecret: false,
    });
    if (c.isEnabled === false) {
      await providerRepo.updateProviderConnection(db, {
        id: row.id,
        orgId,
        isEnabled: false,
      });
    }
    if (c.id) connIdMap.set(c.id, row.id);
    existingConns.push(row);
  }

  for (const [oldId, newId] of connIdMap) {
    result.connectionIdMap[oldId] = newId;
  }

  for (const m of payload.models ?? []) {
    if (!m.modelId || !m.providerKind) continue;
    const oldConn = m.connectionId ?? null;
    const newConn =
      oldConn && oldConn !== "platform"
        ? (connIdMap.get(oldConn) ?? oldConn)
        : oldConn;
    // Prefer remapped modelRef; rebuild if connection changed.
    let modelRef = m.modelRef;
    try {
      const parsed = parseModelRef(m.modelRef);
      if (parsed.connectionId !== "platform" && connIdMap.has(parsed.connectionId)) {
        modelRef = serializeModelRef({
          ...parsed,
          connectionId: connIdMap.get(parsed.connectionId)!,
        });
      } else if (newConn && newConn !== oldConn) {
        modelRef = serializeModelRef({
          providerKind: m.providerKind as never,
          connectionId: newConn,
          modelId: m.modelId,
        });
      }
    } catch {
      if (newConn) {
        modelRef = `${m.providerKind}:${newConn}:${m.modelId}`;
      }
    }

    const already = await providerRepo.getModelByRef(db, orgId, modelRef);
    if (already) {
      if (conflict === "overwrite" && !dryRun) {
        await providerRepo.updateModel(db, {
          id: already.id,
          orgId,
          displayName: m.displayName,
          capabilities: (m.capabilities ?? {}) as Record<string, unknown>,
          isEnabled: m.isEnabled ?? true,
          isVisible: m.isVisible ?? true,
          sortOrder: m.sortOrder,
          inputUsdPer1m:
            m.inputUsdPer1m == null ? null : Number(m.inputUsdPer1m),
          outputUsdPer1m:
            m.outputUsdPer1m == null ? null : Number(m.outputUsdPer1m),
        });
        result.models.updated += 1;
      } else {
        result.models.skipped += 1;
      }
      continue;
    }
    result.models.created += 1;
    if (dryRun) continue;
    await providerRepo.createModel(db, {
      orgId,
      connectionId: newConn === "platform" ? null : newConn,
      providerKind: m.providerKind,
      modelId: m.modelId,
      displayName: m.displayName || m.modelId,
      modelRef,
      capabilities: (m.capabilities ?? { streaming: true }) as Record<
        string,
        unknown
      >,
      isEnabled: m.isEnabled ?? true,
      isVisible: m.isVisible ?? true,
      sortOrder: m.sortOrder ?? 0,
      inputUsdPer1m: m.inputUsdPer1m == null ? null : Number(m.inputUsdPer1m),
      outputUsdPer1m:
        m.outputUsdPer1m == null ? null : Number(m.outputUsdPer1m),
    });
  }

  for (const a of payload.allowlist ?? []) {
    if (!a.modelRef) continue;
    const modelRef = remapModelRef(a.modelRef, connIdMap);
    const existing = await providerRepo.listAllowlist(db, orgId);
    const hit = existing.find(
      (r) =>
        r.modelRef === modelRef &&
        (r.role ?? null) === (a.role ?? null),
    );
    if (hit) {
      result.allowlist.skipped += 1;
      continue;
    }
    result.allowlist.created += 1;
    if (dryRun) continue;
    await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef,
      role: a.role ?? null,
    });
  }

  const existingAgents = dryRun
    ? []
    : await listAgentPresets(db, orgId);
  for (const ag of payload.agents ?? []) {
    if (!ag.name || !ag.slug || !ag.baseModelRef) continue;
    const baseModelRef = remapModelRef(ag.baseModelRef, connIdMap);
    const hit = existingAgents.find((e) => e.slug === ag.slug);
    if (hit) {
      result.agents.skipped += 1;
      continue;
    }
    result.agents.created += 1;
    if (dryRun) continue;
    await createAgentPreset(db, {
      orgId,
      name: ag.name,
      slug: ag.slug,
      baseModelRef,
      systemPrompt: ag.systemPrompt ?? null,
      params: (ag.params ?? {}) as Record<string, unknown>,
      isEnabled: ag.isEnabled ?? true,
      isVisible: ag.isVisible ?? true,
      sortOrder: ag.sortOrder ?? 0,
    });
  }

  for (const p of payload.prices ?? []) {
    if (!p.providerKind || !p.modelIdPattern) continue;
    // Skip platform seeds
    if (p.orgId === null || p.orgId === undefined || p.orgId === orgId) {
      const list = await prices.listPrices(db, orgId);
      const hit = list.find(
        (r) =>
          r.orgId === orgId &&
          r.providerKind === p.providerKind &&
          r.modelIdPattern === p.modelIdPattern,
      );
      if (hit) {
        result.prices.skipped += 1;
        continue;
      }
      result.prices.created += 1;
      if (dryRun) continue;
      await prices.createOrgPrice(db, {
        orgId,
        providerKind: p.providerKind,
        modelIdPattern: p.modelIdPattern,
        inputUsdPer1m: Number(p.inputUsdPer1m),
        outputUsdPer1m: Number(p.outputUsdPer1m),
      });
    }
  }

  if (payload.settings) {
    result.settingsApplied = true;
    if (!dryRun) {
      const patch: Record<string, unknown> = {};
      if (payload.settings.modelDefaults !== undefined) {
        patch.modelDefaults = payload.settings.modelDefaults;
      }
      if (payload.settings.defaultModelRefs !== undefined) {
        const refs = Array.isArray(payload.settings.defaultModelRefs)
          ? payload.settings.defaultModelRefs
          : [];
        patch.defaultModelRefs = refs.map((r: unknown) =>
          remapModelRef(String(r), connIdMap),
        );
      }
      if (payload.settings.pinnedModelRefs !== undefined) {
        const refs = Array.isArray(payload.settings.pinnedModelRefs)
          ? payload.settings.pinnedModelRefs
          : [];
        patch.pinnedModelRefs = refs.map((r: unknown) =>
          remapModelRef(String(r), connIdMap),
        );
      }
      if (Object.keys(patch).length) {
        await patchOrgSettings(db, orgId, patch);
      }
    }
  }

  return result;
}
