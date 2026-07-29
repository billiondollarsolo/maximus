import type { OrgRole } from "@maximus/domain";

export type AllowlistRule = {
  modelRef: string;
  role: OrgRole | null;
};

/**
 * Empty rules → all models allowed.
 * Non-empty → model must match a rule for role or role-null (all roles).
 */
export function isModelAllowed(
  role: OrgRole,
  modelRef: string,
  rules: AllowlistRule[],
): boolean {
  if (rules.length === 0) return true;
  return rules.some(
    (r) =>
      r.modelRef === modelRef && (r.role === null || r.role === role),
  );
}
