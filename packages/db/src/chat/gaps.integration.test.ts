import { describe, expect, it, beforeAll } from "vitest";
import {
  createDb,
  newId,
  members,
  organizations,
  organizationsExt,
  users,
  attachments,
  feedbackRepo,
  providerRepo,
  usageEvents,
  runChatTurn,
  type ChatActor,
} from "../index.js";
import { testMigrate } from "../test-migrate.js";
import {
  encryptSecret,
  generateEncryptionKey,
  resolveAdapter,
} from "@maximus/provider-gateway";
import { AppError } from "@maximus/domain";
import { eq } from "drizzle-orm";
import { listMessagesForConversation } from "../repos/messages.js";
import { getConversation } from "../repos/conversations.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

describe("AC gaps: allowlist, attach, feedback, BYOK resolve", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const ownerId = newId("user");
  const memberId = newId("user");
  const key = generateEncryptionKey();

  const member: ChatActor = {
    user: { id: memberId, email: "m@t.local", name: "M" },
    orgId,
    role: "member",
  };

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    for (const [id, email] of [
      [ownerId, `${ownerId}@t.local`],
      [memberId, `${memberId}@t.local`],
    ] as const) {
      await db.insert(users).values({ id, name: "U", email });
    }
    await db.insert(organizations).values({
      id: orgId,
      name: "G",
      slug: orgId,
    });
    await db.insert(organizationsExt).values({ orgId, settings: {} });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
    });
    await db.insert(members).values({
      id: newId("mem"),
      organizationId: orgId,
      userId: memberId,
      role: "member",
    });
  });

  it("allowlist deny blocks chat for member", async () => {
    const allowedRef = "openai:platform:allowed-only";
    await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef: allowedRef,
      role: null,
    });
    await expect(async () => {
      for await (const _ of runChatTurn({
        db,
        ctx: member,
        body: {
          text: "should fail",
          modelRef: "openai:platform:gpt-4.1",
        },
        providerMode: "fake",
      })) {
        //
      }
    }).rejects.toBeInstanceOf(AppError);
  });

  it("attachmentIds attach to user message content parts", async () => {
    const attId = newId("att");
    await db.insert(attachments).values({
      id: attId,
      orgId,
      uploaderUserId: memberId,
      storageKey: `org/${orgId}/att/${attId}`,
      filename: "note.txt",
      mime: "text/plain",
      sizeBytes: 12,
    });
    let convId = "";
    let userMsgId = "";
    for await (const ev of runChatTurn({
      db,
      ctx: member,
      body: {
        text: "see file",
        attachmentIds: [attId],
        modelRef: "openai:platform:allowed-only",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") {
        convId = ev.conversationId;
        userMsgId = ev.userMessageId;
      }
    }
    const msgs = await listMessagesForConversation(db, convId);
    const user = msgs.find((m) => m.id === userMsgId)!;
    const content = user.content as Array<{ type: string; attachmentId?: string }>;
    expect(content.some((p) => p.type === "file" && p.attachmentId === attId)).toBe(
      true,
    );
  });

  it("attachment-only send (empty text) succeeds with file parts + stream", async () => {
    const attId = newId("att");
    await db.insert(attachments).values({
      id: attId,
      orgId,
      uploaderUserId: memberId,
      storageKey: `org/${orgId}/att/${attId}`,
      filename: "solo.png",
      mime: "image/png",
      sizeBytes: 99,
    });
    let convId = "";
    let userMsgId = "";
    let doneStatus = "";
    for await (const ev of runChatTurn({
      db,
      ctx: member,
      body: {
        text: "",
        attachmentIds: [attId],
        modelRef: "openai:platform:allowed-only",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") {
        convId = ev.conversationId;
        userMsgId = ev.userMessageId;
      }
      if (ev.type === "done") doneStatus = ev.status;
    }
    expect(doneStatus).toBe("complete");
    const msgs = await listMessagesForConversation(db, convId);
    const user = msgs.find((m) => m.id === userMsgId)!;
    const content = user.content as Array<{ type: string; attachmentId?: string }>;
    expect(content.some((p) => p.type === "text")).toBe(false);
    expect(
      content.some((p) => p.type === "image" && p.attachmentId === attId),
    ).toBe(true);
    expect(msgs.some((m) => m.role === "assistant" && m.status === "complete")).toBe(
      true,
    );
    const conv = await getConversation(db, convId);
    expect(conv?.title).toMatch(/Attachment/i);
  });

  it("feedback upsert stores rating", async () => {
    let asstId = "";
    for await (const ev of runChatTurn({
      db,
      ctx: member,
      body: {
        text: "feedback target",
        modelRef: "openai:platform:allowed-only",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") asstId = ev.assistantMessageId;
    }
    const fb = await feedbackRepo.upsertFeedback(db, {
      messageId: asstId,
      userId: memberId,
      rating: "up",
    });
    expect(fb.rating).toBe("up");
    const fb2 = await feedbackRepo.upsertFeedback(db, {
      messageId: asstId,
      userId: memberId,
      rating: "down",
    });
    expect(fb2.rating).toBe("down");
    expect(fb2.id).toBe(fb.id);
  });

  it("BYOK connection encrypts and resolveAdapter uses byok credentials", async () => {
    const apiKey = "sk-byok-secret-value-xyz";
    const enc = encryptSecret(apiKey, key);
    const conn = await providerRepo.createProviderConnection(db, {
      orgId,
      kind: "openai_compatible",
      name: "compat",
      baseUrl: "https://llm.example/v1",
      credentialsEncrypted: enc,
      createdBy: ownerId,
    });
    expect(conn.credentialsEncrypted).not.toBe(apiKey);
    const modelRef = `openai_compatible:${conn.id}:my-model`;
    await providerRepo.upsertAllowlist(db, {
      orgId,
      modelRef,
      role: null,
    });
    const resolved = resolveAdapter({
      modelRef,
      role: "member",
      allowlist: [{ modelRef, role: null }],
      connection: {
        id: conn.id,
        kind: "openai_compatible",
        baseUrl: "https://llm.example/v1",
        apiKey,
        isEnabled: true,
      },
      providerMode: "live",
    });
    expect(resolved.credentials.source).toBe("byok");
    expect(resolved.credentials.apiKey).toBe(apiKey);
    expect(resolved.credentials.baseUrl).toContain("llm.example");
  });

  it("chat turn records usage with cost_micros when priced", async () => {
    let convId = "";
    for await (const ev of runChatTurn({
      db,
      ctx: member,
      body: {
        text: "cost check",
        modelRef: "openai:platform:allowed-only",
      },
      providerMode: "fake",
    })) {
      if (ev.type === "meta") convId = ev.conversationId;
    }
    const rows = await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.conversationId, convId));
    expect(rows[0]?.inputTokens).toBeGreaterThan(0);
    // platform openai prices seeded → cost non-null
    expect(rows[0]?.costMicros).not.toBeNull();
  });
});
