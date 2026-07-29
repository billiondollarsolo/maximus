import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createDb } from "../client.js";
import { newId } from "../ids.js";
import * as conversationRepo from "./conversations.js";
import * as messageRepo from "./messages.js";
import * as usageRepo from "./usage.js";
import { members, organizations, organizationsExt, users } from "../schema/index.js";
import { testMigrate } from "../test-migrate.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("chat repos integration", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "Test",
      email: `${userId}@test.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "Test Org",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId,
      role: "owner",
    });
  });

  afterAll(async () => {
    // leave data; isolated by ids
  });

  it("creates conversation on first message path and persists branch", async () => {
    const conv = await conversationRepo.createConversation(db, {
      orgId,
      userId,
      modelRef: "openai:platform:gpt-4.1",
      title: "Hello world",
      titleSource: "heuristic",
    });
    expect(conv.orgId).toBe(orgId);

    const userMsg = await messageRepo.insertMessage(db, {
      conversationId: conv.id,
      role: "user",
      content: [{ type: "text", text: "hi" }],
      status: "complete",
      position: 0,
    });
    const asst = await messageRepo.insertMessage(db, {
      conversationId: conv.id,
      parentMessageId: userMsg.id,
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
      status: "complete",
      modelRef: "openai:platform:gpt-4.1",
      position: 0,
    });
    await conversationRepo.updateConversation(db, conv.id, {
      activeLeafId: asst.id,
    });

    const msgs = await messageRepo.listMessagesForConversation(db, conv.id);
    expect(msgs).toHaveLength(2);

    const reloaded = await conversationRepo.getConversation(db, conv.id);
    expect(reloaded?.activeLeafId).toBe(asst.id);

    await usageRepo.insertUsageEvent(db, {
      orgId,
      userId,
      conversationId: conv.id,
      messageId: asst.id,
      modelRef: "openai:platform:gpt-4.1",
      providerKind: "openai",
      inputTokens: 10,
      outputTokens: 5,
      costMicros: 100,
      status: "ok",
    });

    const price = await usageRepo.findPrice(db, {
      orgId,
      providerKind: "openai",
      modelId: "gpt-4.1",
    });
    expect(price).not.toBeNull();
  });
});
