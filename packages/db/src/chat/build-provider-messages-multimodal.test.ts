import { describe, expect, it } from "vitest";
import { buildProviderMessagesMultimodal } from "./build-provider-messages-multimodal.js";
import type { HistoryMsg } from "./build-provider-messages.js";

const pngB64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("buildProviderMessagesMultimodal", () => {
  it("embeds base64 images via resolveImage", async () => {
    const msgs: HistoryMsg[] = [
      {
        id: "u1",
        parentMessageId: null,
        role: "user",
        position: 0,
        content: [
          { type: "text", text: "what is this?" },
          {
            type: "image",
            attachmentId: "att_1",
            mime: "image/png",
          },
        ],
      },
    ];
    const history = await buildProviderMessagesMultimodal(
      msgs,
      "u1",
      async (id) => {
        expect(id).toBe("att_1");
        return { mime: "image/png", dataBase64: pngB64 };
      },
    );
    expect(history).toHaveLength(1);
    const content = history[0]!.content;
    expect(Array.isArray(content)).toBe(true);
    const parts = content as Array<{ type: string; dataBase64?: string }>;
    expect(parts.some((p) => p.type === "image" && p.dataBase64 === pngB64)).toBe(
      true,
    );
    expect(parts.some((p) => p.type === "text")).toBe(true);
  });

  it("keeps text-only as string content", async () => {
    const msgs: HistoryMsg[] = [
      {
        id: "u1",
        parentMessageId: null,
        role: "user",
        position: 0,
        content: [{ type: "text", text: "hello" }],
      },
    ];
    const history = await buildProviderMessagesMultimodal(
      msgs,
      "u1",
      async () => null,
    );
    expect(history[0]!.content).toBe("hello");
  });
});
