import type { OrgRole } from "./policies/rbac.js";
import type { AllowlistRule } from "./model-allow.js";
import {
  accessModeFromLegacyAllowlist,
  grantsFromLegacyAllowlist,
  isResourceAllowed,
  type AccessGrant,
  type AccessMode,
} from "./access-grants.js";
import {
  isEmbeddingCapability,
  parseCapabilities,
} from "./model-capabilities.js";

export type CatalogModel = {
  modelRef: string;
  displayName: string;
  providerKind: string;
  isEnabled: boolean;
  /** When false, hidden from picker but may still run if already selected. Default true. */
  isVisible?: boolean;
  capabilities?: Record<string, unknown>;
  sortOrder?: number;
  connectionId?: string | null;
  connectionName?: string | null;
  /** For agents: base offering ref used for grant checks */
  baseModelRef?: string;
};

export type ModelsForUserOptions = {
  /** Include embedding-tagged models (default false). */
  includeEmbeddings?: boolean;
  /** Include non-visible models (default false). */
  includeHidden?: boolean;
  /** Access mode; default open when omitted with empty grants */
  accessMode?: AccessMode;
  /** Grant rows (preferred). When omitted, legacy allowlist is adapted to grants. */
  grants?: AccessGrant[];
  userId?: string;
  teamIds?: string[];
};

/**
 * Thin migration adapter: legacy role allowlist → accessMode + grants.
 * Re-exports domain helpers so catalog code has one import surface.
 */
export function legacyAllowlistToAccess(allowlist: AllowlistRule[]): {
  accessMode: AccessMode;
  grants: AccessGrant[];
} {
  return {
    accessMode: accessModeFromLegacyAllowlist(allowlist),
    grants: grantsFromLegacyAllowlist(allowlist),
  };
}

/**
 * Filter catalog for a user: enabled + visible + not embedding + access.
 *
 * Single path: always {@link isResourceAllowed}. Legacy allowlist (3rd arg) is
 * converted via {@link legacyAllowlistToAccess} when `opts.grants` is omitted
 * and `opts.accessMode` is also omitted.
 */
export function modelsForUser(
  catalog: CatalogModel[],
  role: OrgRole,
  allowlist: AllowlistRule[] = [],
  opts: ModelsForUserOptions = {},
): CatalogModel[] {
  let accessMode: AccessMode;
  let grants: AccessGrant[];

  if (opts.grants !== undefined) {
    accessMode = opts.accessMode ?? "open";
    grants = opts.grants;
  } else if (opts.accessMode !== undefined) {
    accessMode = opts.accessMode;
    grants = [];
  } else {
    const adapted = legacyAllowlistToAccess(allowlist);
    accessMode = adapted.accessMode;
    grants = adapted.grants;
  }

  return catalog.filter((m) => {
    if (!m.isEnabled) return false;
    if (m.isVisible === false && !opts.includeHidden) return false;
    const caps = parseCapabilities(m.capabilities ?? {});
    if (isEmbeddingCapability(caps) && !opts.includeEmbeddings) return false;

    const refForAccess = m.baseModelRef ?? m.modelRef;

    return isResourceAllowed({
      accessMode,
      grants,
      orgRole: role,
      userId: opts.userId ?? "",
      teamIds: opts.teamIds ?? [],
      resourceType: "model",
      resourceRef: refForAccess,
    });
  });
}
