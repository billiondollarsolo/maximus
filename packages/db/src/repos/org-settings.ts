import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { organizationsExt } from "../schema/index.js";

/**
 * Read org-level rateLimitFailOpen (D16). Default fail-closed when unset.
 */
export async function getOrgRateLimitFailOpen(
  db: Db,
  orgId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(organizationsExt)
    .where(eq(organizationsExt.orgId, orgId))
    .limit(1);
  if (!row) return false;
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return settings.rateLimitFailOpen === true;
}
