import type { OrgRole } from "./policies/rbac.js";
import { isModelAllowed, type AllowlistRule } from "./model-allow.js";
import {
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
  /** New grant rows (preferred over legacy allowlist) */
  grants?: AccessGrant[];
  userId?: string;
  teamIds?: string[];
};

/**
 * Filter catalog for a user: enabled + visible + not embedding + access.
 *
 * Access:
 * - If `grants` provided (or accessMode allowlist): use isResourceAllowed.
 * - Else legacy: empty allowlist = all; non-empty = role rules.
 * - Agents: check baseModelRef when set, else modelRef.
 */
export function modelsForUser(
  catalog: CatalogModel[],
  role: OrgRole,
  allowlist: AllowlistRule[] = [],
  opts: ModelsForUserOptions = {},
): CatalogModel[] {
  const accessMode = opts.accessMode ?? "open";
  const grants = opts.grants;
  const useGrants = grants !== undefined;

  return catalog.filter((m) => {
    if (!m.isEnabled) return false;
    if (m.isVisible === false && !opts.includeHidden) return false;
    const caps = parseCapabilities(m.capabilities ?? {});
    if (isEmbeddingCapability(caps) && !opts.includeEmbeddings) return false;

    const refForAccess = m.baseModelRef ?? m.modelRef;

    if (useGrants) {
      return isResourceAllowed({
        accessMode,
        grants: grants ?? [],
        orgRole: role,
        userId: opts.userId ?? "",
        teamIds: opts.teamIds ?? [],
        resourceType: "model",
        resourceRef: refForAccess,
      });
    }

    // Legacy allowlist path (empty = open)
    return isModelAllowed(role, refForAccess, allowlist);
  });
}
