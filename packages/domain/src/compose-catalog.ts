import type { CatalogModel } from "./models-for-user.js";

export type ComposeCatalogInput = {
  platform: CatalogModel[];
  orgModels: CatalogModel[];
};

/**
 * Merge platform defaults with org models.
 * Org row with the same modelRef overrides platform (display/enabled/capabilities).
 * Org-only modelRefs are appended. Does not filter by isEnabled or allowlist —
 * callers apply modelsForUser after.
 */
export function composeCatalog(input: ComposeCatalogInput): CatalogModel[] {
  const orgByRef = new Map<string, CatalogModel>();
  for (const m of input.orgModels) {
    orgByRef.set(m.modelRef, m);
  }

  const merged: CatalogModel[] = [];
  const seen = new Set<string>();

  for (const p of input.platform) {
    const override = orgByRef.get(p.modelRef);
    if (override) {
      merged.push(override);
    } else {
      merged.push(p);
    }
    seen.add(p.modelRef);
  }

  for (const o of input.orgModels) {
    if (!seen.has(o.modelRef)) {
      merged.push(o);
      seen.add(o.modelRef);
    }
  }

  return merged.sort((a, b) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return a.displayName.localeCompare(b.displayName);
  });
}
