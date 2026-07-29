import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  members,
  organizations,
  organizationsExt,
  users,
  exportConversation,
  runChatTurn,
  type ChatActor,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import { AppError } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("exportConversation shared builder (used by /api/export)", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const otherUser = newId("user");
  const ctx: ChatActor = {
    user: { id: userId, email: "e@t.local", name: "E" },
    orgId,
    role: "member",
  };

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    for (const [id, email] of [
      [userId, `${userId}@t.local`],
      [otherUser, `${otherUser}@t.local`],
    ] as const) {
      await db.insert(users).values({ id, name: "U", email });
    }
    await db.insert(organizations).values({
      id: orgId,
      name: "E",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId,
      role: "member",
    });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId: otherUser,
      role: "admin",
    });
  });

  it("owner exports markdown via shared builder", async () => {
    let convId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "Export me please",
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") convId = ev.conversationId;
    }

    const result = await exportConversation(
      db,
      { userId, orgId, role: "member" },
      { id: convId, format: "md" },
    );
    expect(result.format).toBe("md");
    expect(result.body).toContain("Export me please");
    expect(result.body).toContain("## user");
    expect(result.body).toContain("## assistant");
  });

  it("admin cannot export another member's conversation", async () => {
    let convId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "private export",
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") convId = ev.conversationId;
    }

    await expect(
      exportConversation(
        db,
        { userId: otherUser, orgId, role: "admin" },
        { id: convId, format: "md" },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("json format returns conversation + messages", async () => {
    let convId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "json export",
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") convId = ev.conversationId;
    }
    const result = await exportConversation(
      db,
      { userId, orgId, role: "member" },
      { id: convId, format: "json" },
    );
    expect(result.format).toBe("json");
    expect(result.body).toMatchObject({
      conversation: expect.objectContaining({ id: convId }),
      messages: expect.any(Array),
    });
  });
});
