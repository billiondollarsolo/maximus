import { describe, expect, it, beforeAll } from "vitest";
import {
  assertVisionAllowed,
  modelAcceptsImages,
  modelCanGenerateImages,
  parseCapabilities,
} from "@maximus/domain";
import { FAKE_PNG_BYTES, generateImage } from "@maximus/provider-gateway";
import { createDb } from "../client.js";
import { newId } from "../ids.js";
import { testMigrate } from "../test-migrate.js";
import {
  members,
  organizations,
  organizationsExt,
  users,
} from "../schema/index.js";
import * as attachmentsRepo from "../repos/attachments.js";
import { listMessagesForConversation } from "../repos/messages.js";
import { runChatTurn } from "./run-chat-turn.js";
import { AppError } from "@maximus/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://maximus:maximus@localhost:5432/maximus";

const pngB64 = FAKE_PNG_BYTES.toString("base64");

describe("vision gate + image gen integration", () => {
  const db = createDb(DATABASE_URL);
  const orgId = newId("org");
  const userId = newId("user");
  const ctx = {
    user: { id: userId, email: `${userId}@t.local`, name: "T" },
    orgId,
    role: "owner" as const,
  };

  beforeAll(async () => {
    await testMigrate(DATABASE_URL);
    await db.insert(users).values({
      id: userId,
      name: "T",
      email: `${userId}@t.local`,
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "OrgV",
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

  it("rejects non-vision + image via assertVisionAllowed", () => {
    expect(() =>
      assertVisionAllowed(parseCapabilities({}), [{ type: "image" }]),
    ).toThrow(AppError);
    expect(modelAcceptsImages({ vision: true })).toBe(true);
    expect(modelCanGenerateImages({ imageGen: true })).toBe(true);
  });

  it("chat turn with image + non-vision model fails", async () => {
    const att = await attachmentsRepo.createAttachment(db, {
      orgId,
      uploaderUserId: userId,
      storageKey: `org/${orgId}/att/x`,
      filename: "x.png",
      mime: "image/png",
      sizeBytes: 10,
    });
    const events = [];
    try {
      for await (const ev of runChatTurn({
        db,
        ctx,
        body: {
          text: "see this",
          attachmentIds: [att.id],
          modelRef: "ollama:platform:llama3.2",
          mode: "send",
        },
        providerMode: "fake",
        resolveImage: async () => ({ mime: "image/png", dataBase64: pngB64 }),
      })) {
        events.push(ev);
      }
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION");
    }
  });

  it("chat turn with image + vision fake completes", async () => {
    const att = await attachmentsRepo.createAttachment(db, {
      orgId,
      uploaderUserId: userId,
      storageKey: `org/${orgId}/att/v`,
      filename: "v.png",
      mime: "image/png",
      sizeBytes: 32,
    });
    const types: string[] = [];
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "describe",
        attachmentIds: [att.id],
        modelRef: "openai:platform:gpt-4.1",
        mode: "send",
      },
      providerMode: "fake",
      resolveImage: async () => ({ mime: "image/png", dataBase64: pngB64 }),
    })) {
      types.push(ev.type);
    }
    expect(types).toContain("meta");
    expect(types).toContain("text");
    expect(types).toContain("done");
  });

  it("image gen turn stores model image part readable after reload", async () => {
    const stored = new Map<string, Buffer>();
    const types: string[] = [];
    let doneParts: unknown;
    let convId = "";
    let asstId = "";
    for await (const ev of runChatTurn({
      db,
      ctx,
      body: {
        text: "a red cube",
        modelRef: "openai:platform:gpt-image-1",
        mode: "send",
        interactionMode: "image_gen",
      },
      providerMode: "fake",
      storage: {
        getObjectBuffer: async (key) => {
          const b = stored.get(key);
          if (!b) throw new Error("missing");
          return { body: b, contentType: "image/png" };
        },
        putObjectBuffer: async (key, body) => {
          stored.set(key, body);
        },
        attachmentKey: (o, id) => `org/${o}/att/${id}`,
      },
    })) {
      types.push(ev.type);
      if (ev.type === "meta") {
        convId = ev.conversationId;
        asstId = ev.assistantMessageId;
      }
      if (ev.type === "done") doneParts = ev.contentParts;
    }
    expect(types).toContain("done");
    expect(Array.isArray(doneParts)).toBe(true);
    const parts = doneParts as Array<{
      type: string;
      source?: string;
      attachmentId?: string;
    }>;
    const imgPart = parts.find((p) => p.type === "image" && p.source === "model");
    expect(imgPart?.attachmentId).toBeTruthy();
    expect(stored.size).toBeGreaterThan(0);
    const bytes = [...stored.values()][0]!;
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);

    // Reload path: list messages from DB + org-scoped attachment lookup
    const reloaded = await listMessagesForConversation(db, convId);
    const asst = reloaded.find((m) => m.id === asstId);
    expect(asst).toBeDefined();
    const reloadedParts = asst!.content as Array<{
      type: string;
      attachmentId?: string;
      source?: string;
      prompt?: string;
    }>;
    const reloadedImg = reloadedParts.find(
      (p) => p.type === "image" && p.attachmentId === imgPart!.attachmentId,
    );
    expect(reloadedImg).toBeDefined();
    expect(reloadedImg!.source).toBe("model");

    const attRow = await attachmentsRepo.getAttachmentForOrg(
      db,
      orgId,
      imgPart!.attachmentId!,
    );
    expect(attRow).not.toBeNull();
    expect(attRow!.meta).toMatchObject({ source: "model" });
    expect(attRow!.mime).toBe("image/png");
  });

  it("chat-only model cannot take image_gen path", async () => {
    try {
      for await (const _ of runChatTurn({
        db,
        ctx,
        body: {
          text: "draw a cat",
          modelRef: "openai:platform:gpt-4.1",
          mode: "send",
          interactionMode: "image_gen",
        },
        providerMode: "fake",
      })) {
        // drain
      }
      expect.fail("should reject chat-only model on image_gen");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("VALIDATION");
      expect((e as AppError).message).toMatch(/cannot generate images/i);
    }
  });

  it("fake generateImage returns PNG magic", async () => {
    const out = await generateImage({
      providerKind: "openai",
      modelId: "x",
      prompt: "y",
      mode: "fake",
    });
    expect(out.bytes.subarray(0, 4).toString("binary")).toContain("PNG");
  });
});
