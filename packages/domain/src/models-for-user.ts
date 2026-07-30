import type { OrgRole } from "./policies/rbac.js";
import { isModelAllowed, type AllowlistRule } from "./model-allow.js";

export type CatalogModel = {
  modelRef: string;
  displayName: string;
  providerKind: string;
  isEnabled: boolean;
  capabilities?: Record<string, unknown>;
  sortOrder?: number;
};

/**
 * Filter catalog for a user role: must be enabled + pass allowlist (empty = all).
 */
export function modelsForUser(
  catalog: CatalogModel[],
  role: OrgRole,
  allowlist: AllowlistRule[],
): CatalogModel[] {
  return catalog.filter(
    (m) => m.isEnabled && isModelAllowed(role, m.modelRef, allowlist),
  );
}
