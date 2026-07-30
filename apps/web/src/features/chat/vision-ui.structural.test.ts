import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("vision + image gen UI structural", () => {
  it("has attachment GET route", () => {
    expect(existsSync(join(root, "routes/api/attachments.$id.ts"))).toBe(true);
    expect(read("routes/api/attachments.$id.ts")).toContain("getObjectBuffer");
  });

  it("composer gates vision mismatch", () => {
    const src = read("features/chat/composer.tsx");
    expect(src).toContain("visionMismatch");
    expect(src).toMatch(/can.?t see images|cannot see images|Vision model/i);
    expect(src).toContain("image_gen");
  });

  it("model select shows Vision and Image badges", () => {
    const src = read("features/chat/model-select.tsx");
    expect(src).toContain("Vision");
    expect(src).toContain("Image");
    expect(src).toContain("imageGen");
  });

  it("message list renders AttachmentImage", () => {
    const src = read("features/chat/message-list.tsx");
    expect(src).toContain("AttachmentImage");
    const img = read("features/chat/attachment-image.tsx");
    expect(img).toContain("/api/attachments/");
  });

  it("chat API passes storage + interactionMode", () => {
    const src = read("routes/api/chat.ts");
    expect(src).toContain("interactionMode");
    expect(src).toContain("putObjectBuffer");
  });

  it("SSE finalize supports contentParts", () => {
    const src = read("features/chat/consume-chat-sse.ts");
    expect(src).toContain("contentParts");
  });
});
