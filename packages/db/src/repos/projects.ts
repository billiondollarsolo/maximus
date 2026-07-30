import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../client.js";
import { projects } from "../schema/index.js";
import { newId } from "../ids.js";

export async function listProjects(
  db: Db,
  input: { orgId: string; userId: string; limit?: number },
) {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.orgId, input.orgId),
        eq(projects.ownerUserId, input.userId),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(desc(projects.updatedAt))
    .limit(input.limit ?? 50);
}

export async function getProject(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

export async function createProject(
  db: Db,
  input: {
    orgId: string;
    ownerUserId: string;
    name: string;
    instructions?: string | null;
    defaultModelRef?: string | null;
  },
) {
  const [row] = await db
    .insert(projects)
    .values({
      id: newId("proj"),
      orgId: input.orgId,
      ownerUserId: input.ownerUserId,
      name: input.name.trim(),
      instructions: input.instructions ?? null,
      defaultModelRef: input.defaultModelRef ?? null,
    })
    .returning();
  return row!;
}

export async function updateProject(
  db: Db,
  input: {
    id: string;
    orgId: string;
    ownerUserId: string;
    name?: string;
    instructions?: string | null;
    defaultModelRef?: string | null;
    archivedAt?: Date | null;
  },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.instructions !== undefined) patch.instructions = input.instructions;
  if (input.defaultModelRef !== undefined) {
    patch.defaultModelRef = input.defaultModelRef;
  }
  if (input.archivedAt !== undefined) patch.archivedAt = input.archivedAt;

  const [row] = await db
    .update(projects)
    .set(patch)
    .where(
      and(
        eq(projects.id, input.id),
        eq(projects.orgId, input.orgId),
        eq(projects.ownerUserId, input.ownerUserId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteProject(
  db: Db,
  input: { id: string; orgId: string; ownerUserId: string },
) {
  const deleted = await db
    .delete(projects)
    .where(
      and(
        eq(projects.id, input.id),
        eq(projects.orgId, input.orgId),
        eq(projects.ownerUserId, input.ownerUserId),
      ),
    )
    .returning();
  return deleted[0] ?? null;
}
