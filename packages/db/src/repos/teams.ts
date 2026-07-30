import { and, asc, eq } from "drizzle-orm";
import { newId } from "../ids.js";
import type { Db } from "../client.js";
import { teamMembers, teams } from "../schema/index.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function listTeams(db: Db, orgId: string) {
  return db
    .select()
    .from(teams)
    .where(eq(teams.orgId, orgId))
    .orderBy(asc(teams.name));
}

export async function getTeam(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createTeam(
  db: Db,
  input: { orgId: string; name: string; slug?: string },
) {
  const [row] = await db
    .insert(teams)
    .values({
      id: newId("team"),
      orgId: input.orgId,
      name: input.name.trim(),
      slug: (input.slug?.trim() || slugify(input.name)) || newId("slug"),
    })
    .returning();
  return row!;
}

export async function updateTeam(
  db: Db,
  input: { id: string; orgId: string; name?: string; slug?: string },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  const [row] = await db
    .update(teams)
    .set(patch)
    .where(and(eq(teams.id, input.id), eq(teams.orgId, input.orgId)))
    .returning();
  return row ?? null;
}

export async function deleteTeam(db: Db, orgId: string, id: string) {
  await db
    .delete(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.id, id)));
}

export async function listTeamMembers(db: Db, teamId: string) {
  return db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
}

export async function addTeamMember(
  db: Db,
  input: { teamId: string; userId: string; role?: string },
) {
  const existing = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, input.teamId),
        eq(teamMembers.userId, input.userId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(teamMembers)
    .values({
      id: newId("tmem"),
      teamId: input.teamId,
      userId: input.userId,
      role: input.role ?? "member",
    })
    .returning();
  return row!;
}

export async function removeTeamMember(
  db: Db,
  input: { teamId: string; userId: string },
) {
  await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, input.teamId),
        eq(teamMembers.userId, input.userId),
      ),
    );
}

/** Team ids for a user within an org. */
export async function listTeamIdsForUser(
  db: Db,
  orgId: string,
  userId: string,
): Promise<string[]> {
  const orgTeams = await listTeams(db, orgId);
  if (!orgTeams.length) return [];
  const ids = orgTeams.map((t) => t.id);
  const rows = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
  return rows.filter((r) => ids.includes(r.teamId)).map((r) => r.teamId);
}
