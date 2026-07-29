import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  members,
  organizations,
  organizationsExt,
  users,
  conversationRepo,
  messageRepo,
  runChatTurn,
  type ChatActor,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import { textFromParts, type ContentPart } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("export own chat", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const ctx: ChatActor = {
    user: { id: userId, email: "e@t.local", name: "E" },
    orgId,
    role: "member",
  };

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "E",
      email: `${userId}@t.local`,
    });
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
  });

  it("owner can export markdown of own conversation", async () => {
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
    const conv = await conversationRepo.getConversation(db, convId);
    expect(conv?.userId).toBe(userId);
    const msgs = await messageRepo.listMessagesForConversation(db, convId);
    const md = [
      `# ${conv?.title ?? "Conversation"}`,
      "",
      ...msgs.map((m) => {
        const text = textFromParts((m.content as ContentPart[]) ?? []);
        return `## ${m.role}\n\n${text}\n`;
      }),
    ].join("\n");
    expect(md).toContain("Export me please");
    expect(md).toContain("## user");
    expect(md).toContain("## assistant");
  });
});
