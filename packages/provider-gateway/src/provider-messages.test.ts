import { describe, expect, it } from "vitest";
import {
  toAnthropicUserContent,
  toOllamaMessage,
  toOpenAiChatMessages,
} from "./provider-messages.js";

const pngB64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("toOpenAiChatMessages", () => {
  it("maps images to image_url data URLs", () => {
    const body = toOpenAiChatMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "see?" },
          { type: "image", mime: "image/png", dataBase64: pngB64 },
        ],
      },
    ]);
    const content = body[0]!.content as Array<Record<string, unknown>>;
    expect(content.some((c) => c.type === "image_url")).toBe(true);
    const img = content.find((c) => c.type === "image_url") as {
      image_url: { url: string };
    };
    expect(img.image_url.url).toContain("data:image/png;base64,");
    expect(img.image_url.url).toContain(pngB64);
  });
});

describe("toAnthropicUserContent", () => {
  it("maps base64 image source", () => {
    const c = toAnthropicUserContent([
      { type: "image", mime: "image/png", dataBase64: pngB64 },
      { type: "text", text: "describe" },
    ]) as Array<Record<string, unknown>>;
    expect(c[0]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: pngB64 },
    });
  });
});

describe("toOllamaMessage", () => {
  it("puts base64 in images array", () => {
    const m = toOllamaMessage({
      role: "user",
      content: [
        { type: "text", text: "hi" },
        { type: "image", mime: "image/png", dataBase64: pngB64 },
      ],
    });
    expect(m.content).toBe("hi");
    expect(m.images).toEqual([pngB64]);
  });
});
