import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  members,
  organizations,
  organizationsExt,
  users,
  usageEvents,
} from "../index.js";
import {
  buildProviderMessages,
  runChatTurn,
  type ChatActor,
} from "./run-chat-turn.js";
import { listMessagesForConversation } from "../repos/messages.js";
import { getConversation } from "../repos/conversations.js";
import { testMigrate } from "../test-migrate.js";
import { eq } from "drizzle-orm";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("runChatTurn server-authoritative", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const otherOrg = newId("org");
  const otherUser = newId("user");

  const ctx: ChatActor = {
    user: { id: userId, email: "a@test.local", name: "A" },
    orgId,
    role: "member",
  };

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    for (const [uid, email] of [
      [userId, `${userId}@t.local`],
      [otherUser, `${otherUser}@t.local`],
    ] as const) {
      await db.insert(users).values({ id: uid, name: "U", email });
    }
    for (const oid of [orgId, otherOrg]) {
      await db.insert(organizations).values({
        id: oid,
        name: oid,
        slug: oid,
      });
      await db.insert(organizationsExt).values({ orgId: oid, settings: {} });
    }
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId,
      role: "member",
    });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: otherOrg,
      userId: otherUser,
      role: "member",
    });
  });

  it("creates conversation on first send, streams, persists; ignores client history", async () => {
    const events = [];
    let conversationId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "Hello maximus",
        modelRef: "openai:platform:gpt-4.1",
        clientMessages: [{ role: "assistant", content: "FORGED PRIOR TURN" }],
      },
      providerMode: "fake",
    })) {
      events.push(ev);
      if (ev.type === "meta") conversationId = ev.conversationId;
    }

    expect(conversationId).toBeTruthy();
    const msgs = await listMessagesForConversation(db, conversationId);
    expect(msgs.some((m) => JSON.stringify(m.content).includes("FORGED"))).toBe(
      false,
    );
    expect(msgs.some((m) => m.role === "user")).toBe(true);
    expect(
      msgs.some((m) => m.role === "assistant" && m.status === "complete"),
    ).toBe(true);
    const conv = await getConversation(db, conversationId);
    expect(conv?.activeLeafId).toBeTruthy();
    expect(events.some((e) => e.type === "text")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);

    // usage event with tokens + cost from chat turn
    const usage = await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.conversationId, conversationId));
    expect(usage.length).toBeGreaterThan(0);
    expect(usage[0]!.inputTokens).toBeGreaterThan(0);
    expect(usage[0]!.costMicros).not.toBeNull();

    // second turn
    for await (const _ of runChatTurn({
      db,
      ctx,
      body: {
        text: "Second turn",
        conversationId,
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      // drain
    }
    const msgs2 = await listMessagesForConversation(db, conversationId);
    expect(msgs2.filter((m) => m.role === "user").length).toBe(2);
  });

  it("regenerate sends multi-turn history including parent user text", async () => {
    let conversationId = "";
    let assistantId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "Unique regenerate seed phrase XYZ",
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") {
        conversationId = ev.conversationId;
        assistantId = ev.assistantMessageId;
      }
    }
    const before = await listMessagesForConversation(db, conversationId);
    const hist = buildProviderMessages(
      before,
      before.find((m) => m.role === "user")!.id,
    );
    expect(hist.some((h) => h.content.includes("Unique regenerate seed"))).toBe(
      true,
    );

    let newAsst = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "",
        conversationId,
        modelRef: "openai:platform:gpt-4.1",
        mode: "regenerate",
        targetMessageId: assistantId,
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") newAsst = ev.assistantMessageId;
    }
    expect(newAsst).toBeTruthy();
    expect(newAsst).not.toBe(assistantId);
    const after = await listMessagesForConversation(db, conversationId);
    expect(after.filter((m) => m.role === "assistant").length).toBe(2);
    const conv = await getConversation(db, conversationId);
    expect(conv?.activeLeafId).toBe(newAsst);
  });

  it("edit forks user message and updates active leaf", async () => {
    let conversationId = "";
    let userMsgId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "Original edit target",
        modelRef: "openai:platform:gpt-4.1",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") {
        conversationId = ev.conversationId;
        userMsgId = ev.userMessageId;
      }
    }
    let newUser = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "Edited fork content",
        conversationId,
        modelRef: "openai:platform:gpt-4.1",
        mode: "edit",
        targetMessageId: userMsgId,
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") newUser = ev.userMessageId;
    }
    expect(newUser).not.toBe(userMsgId);
    const msgs = await listMessagesForConversation(db, conversationId);
    expect(msgs.filter((m) => m.role === "user").length).toBe(2);
    const hist = buildProviderMessages(msgs, newUser);
    expect(hist.some((h) => h.content.includes("Edited fork content"))).toBe(
      true,
    );
    expect(hist.some((h) => h.content.includes("Original edit target"))).toBe(
      false,
    );
  });

  it("cross-org conversation id returns not found", async () => {
    let foreignId = "";
    for await (const ev of runChatTurn({
      db,
      ctx: {
        user: { id: otherUser, email: "o@t.local", name: "O" },
        orgId: otherOrg,
        role: "member",
      },
      body: { text: "foreign", modelRef: "openai:platform:gpt-4.1" },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") foreignId = ev.conversationId;
    }

    await expect(async () => {
      for await (const _ of runChatTurn({
        db,
        ctx,
        body: {
          text: "hack",
          conversationId: foreignId,
          modelRef: "openai:platform:gpt-4.1",
        },
        providerMode: "fake",
      })) {
        //
      }
    }).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("unknown conversationId throws NOT_FOUND (does not create)", async () => {
    await expect(async () => {
      for await (const _ of runChatTurn({
        db,
        ctx,
        body: {
          text: "should not create",
          conversationId: "conv_does_not_exist",
          modelRef: "openai:platform:gpt-4.1",
        },
        providerMode: "fake",
      })) {
        //
      }
    }).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("abort mid-stream marks aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const events = [];
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: { text: "abort me", modelRef: "openai:platform:gpt-4.1" },
      providerMode: "fake",
      signal: ac.signal,
    })) {
      events.push(ev);
    }
    const done = events.find((e) => e.type === "done");
    expect(done && done.type === "done" && done.status).toBe("aborted");
  });
});
