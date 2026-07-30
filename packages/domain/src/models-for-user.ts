import type { OrgRole } from "./policies/rbac.js";
import { isModelAllowed, type AllowlistRule } from "./model-allow.js";
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
};

export type ModelsForUserOptions = {
  /** Include embedding-tagged models (default false). */
  includeEmbeddings?: boolean;
  /** Include non-visible models (default false). */
  includeHidden?: boolean;
};

/**
 * Filter catalog for a user role: enabled + visible + allowlist + not embedding.
 */
export function modelsForUser(
  catalog: CatalogModel[],
  role: OrgRole,
  allowlist: AllowlistRule[],
  opts: ModelsForUserOptions = {},
): CatalogModel[] {
  return catalog.filter((m) => {
    if (!m.isEnabled) return false;
    if (m.isVisible === false && !opts.includeHidden) return false;
    const caps = parseCapabilities(m.capabilities ?? {});
    if (isEmbeddingCapability(caps) && !opts.includeEmbeddings) return false;
    if (!isModelAllowed(role, m.modelRef, allowlist)) return false;
    return true;
  });
}
