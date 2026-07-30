import type { OrgRole } from "./policies/rbac.js";
import type { AllowlistRule } from "./model-allow.js";

export type AccessMode = "open" | "allowlist";

export type GrantSubjectType = "org" | "role" | "team" | "user";

export type AccessGrant = {
  resourceType: "model" | "agent";
  resourceRef: string;
  subjectType: GrantSubjectType;
  /** null only for subjectType=org */
  subjectId: string | null;
  effect?: "allow";
};

export type AccessContext = {
  accessMode: AccessMode;
  grants: AccessGrant[];
  orgRole: OrgRole;
  userId: string;
  /** All team ids the user belongs to in the active org */
  teamIds: string[];
};

/**
 * Parse org settings.accessMode; default open.
 */
export function parseAccessMode(raw: unknown): AccessMode {
  if (raw === "allowlist") return "allowlist";
  return "open";
}

/**
 * Whether a resource is allowed under accessMode + grants.
 * open → always true (grants ignored for inclusion).
 * allowlist → at least one matching allow grant.
 */
export function isResourceAllowed(
  input: AccessContext & {
    resourceType: "model" | "agent";
    resourceRef: string;
  },
): boolean {
  if (input.accessMode === "open") return true;

  const teamSet = new Set(input.teamIds);
  return input.grants.some((g) => {
    if (g.effect != null && g.effect !== "allow") return false;
    if (g.resourceType !== input.resourceType) return false;
    if (g.resourceRef !== input.resourceRef) return false;
    switch (g.subjectType) {
      case "org":
        return true;
      case "role":
        return g.subjectId === input.orgRole;
      case "team":
        return g.subjectId != null && teamSet.has(g.subjectId);
      case "user":
        return g.subjectId === input.userId;
      default:
        return false;
    }
  });
}

/**
 * Convert legacy model_allowlists rows into grants.
 * role null → subject_type org (whole org).
 */
export function grantsFromLegacyAllowlist(
  rules: AllowlistRule[],
): AccessGrant[] {
  return rules.map((r) => ({
    resourceType: "model" as const,
    resourceRef: r.modelRef,
    subjectType: (r.role == null ? "org" : "role") as GrantSubjectType,
    subjectId: r.role,
    effect: "allow" as const,
  }));
}

/**
 * Infer accessMode from legacy allowlist presence.
 * Empty → open; any rows → allowlist.
 */
export function accessModeFromLegacyAllowlist(
  rules: AllowlistRule[],
): AccessMode {
  return rules.length === 0 ? "open" : "allowlist";
}
