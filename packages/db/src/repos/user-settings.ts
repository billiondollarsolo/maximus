import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { customInstructions } from "../schema/index.js";

export type CustomInstructions = {
  aboutUser: string | null;
  preferredResponse: string | null;
  updatedAt: Date;
};

export async function getCustomInstructions(
  db: Db,
  input: { userId: string; orgId: string },
): Promise<CustomInstructions | null> {
  const [row] = await db
    .select()
    .from(customInstructions)
    .where(
      and(
        eq(customInstructions.userId, input.userId),
        eq(customInstructions.orgId, input.orgId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    aboutUser: row.aboutUser,
    preferredResponse: row.preferredResponse,
    updatedAt: row.updatedAt,
  };
}

export async function upsertCustomInstructions(
  db: Db,
  input: {
    userId: string;
    orgId: string;
    aboutUser?: string | null;
    preferredResponse?: string | null;
  },
): Promise<CustomInstructions> {
  const existing = await getCustomInstructions(db, input);
  const aboutUser =
    input.aboutUser !== undefined
      ? input.aboutUser
      : (existing?.aboutUser ?? null);
  const preferredResponse =
    input.preferredResponse !== undefined
      ? input.preferredResponse
      : (existing?.preferredResponse ?? null);
  const updatedAt = new Date();

  if (existing) {
    const [row] = await db
      .update(customInstructions)
      .set({ aboutUser, preferredResponse, updatedAt })
      .where(
        and(
          eq(customInstructions.userId, input.userId),
          eq(customInstructions.orgId, input.orgId),
        ),
      )
      .returning();
    return {
      aboutUser: row!.aboutUser,
      preferredResponse: row!.preferredResponse,
      updatedAt: row!.updatedAt,
    };
  }

  const [row] = await db
    .insert(customInstructions)
    .values({
      userId: input.userId,
      orgId: input.orgId,
      aboutUser,
      preferredResponse,
      updatedAt,
    })
    .returning();
  return {
    aboutUser: row!.aboutUser,
    preferredResponse: row!.preferredResponse,
    updatedAt: row!.updatedAt,
  };
}
