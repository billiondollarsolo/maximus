import { describe, expect, it } from "vitest";
import {
  appendAssistantText,
  finalizeAssistant,
} from "./consume-chat-sse";
import type { ServerMsg } from "./chat-types";

const base: ServerMsg = {
  id: "a1",
  role: "assistant",
  parentMessageId: "u1",
  position: 0,
  content: [{ type: "text", text: "Hi" }],
  status: "streaming",
};

describe("consume-chat-sse helpers", () => {
  it("appendAssistantText concatenates onto temp assistant", () => {
    const out = appendAssistantText([base], "a1", " there");
    expect(out[0]!.content[0]!.text).toBe("Hi there");
  });

  it("finalizeAssistant sets content and status", () => {
    const out = finalizeAssistant([base], "a1", "Done", "complete");
    expect(out[0]!.content[0]!.text).toBe("Done");
    expect(out[0]!.status).toBe("complete");
  });

  it("finalizeAssistant prefers contentParts for gen images", () => {
    const out = finalizeAssistant([base], "a1", "", "complete", [
      {
        type: "image",
        attachmentId: "att_x",
        mime: "image/png",
        source: "model",
      },
    ]);
    expect(out[0]!.content[0]).toMatchObject({
      type: "image",
      attachmentId: "att_x",
    });
  });
});
