import { describe, expect, it } from "vitest";
import {
  assertChatTurnInput,
  conversationTitleFromInput,
} from "./chat-input.js";
import { AppError } from "./errors.js";

describe("assertChatTurnInput", () => {
  it("rejects empty send", () => {
    expect(() => assertChatTurnInput({ text: "" })).toThrow(AppError);
    expect(() => assertChatTurnInput({ text: "   ", attachmentIds: [] })).toThrow(
      /text or attachments/i,
    );
  });

  it("accepts text-only send", () => {
    const n = assertChatTurnInput({ text: "  hello  " });
    expect(n).toMatchObject({
      text: "hello",
      attachmentIds: [],
      mode: "send",
      hasContent: true,
    });
  });

  it("accepts attachment-only send", () => {
    const n = assertChatTurnInput({
      text: "",
      attachmentIds: ["att_1"],
    });
    expect(n.hasContent).toBe(true);
    expect(n.attachmentIds).toEqual(["att_1"]);
    expect(n.text).toBe("");
  });

  it("accepts text + attachments", () => {
    const n = assertChatTurnInput({
      text: "see",
      attachmentIds: ["a", "b"],
    });
    expect(n.text).toBe("see");
    expect(n.attachmentIds).toEqual(["a", "b"]);
  });

  it("filters empty attachment ids", () => {
    const n = assertChatTurnInput({
      text: "x",
      attachmentIds: ["a", "", "b"] as string[],
    });
    expect(n.attachmentIds).toEqual(["a", "b"]);
  });

  it("regenerate requires targetMessageId; content optional", () => {
    expect(() =>
      assertChatTurnInput({ mode: "regenerate", text: "" }),
    ).toThrow(/targetMessageId/);
    const n = assertChatTurnInput({
      mode: "regenerate",
      targetMessageId: "msg_asst",
      text: "",
    });
    expect(n.mode).toBe("regenerate");
    expect(n.targetMessageId).toBe("msg_asst");
    expect(n.hasContent).toBe(false);
  });

  it("edit requires targetMessageId and content", () => {
    expect(() =>
      assertChatTurnInput({
        mode: "edit",
        targetMessageId: "msg_u",
        text: "",
      }),
    ).toThrow(/text or attachments/i);
    expect(() =>
      assertChatTurnInput({ mode: "edit", text: "hi" }),
    ).toThrow(/targetMessageId/);
    const n = assertChatTurnInput({
      mode: "edit",
      targetMessageId: "msg_u",
      text: "edited",
    });
    expect(n.mode).toBe("edit");
    expect(n.text).toBe("edited");
  });
});

describe("conversationTitleFromInput", () => {
  it("prefers text, else attachment labels", () => {
    expect(
      conversationTitleFromInput(
        assertChatTurnInput({ text: "Hello world" }),
      ),
    ).toBe("Hello world");
    expect(
      conversationTitleFromInput(
        assertChatTurnInput({ text: "", attachmentIds: ["a"] }),
      ),
    ).toBe("Attachment");
    expect(
      conversationTitleFromInput(
        assertChatTurnInput({ text: "", attachmentIds: ["a", "b"] }),
      ),
    ).toBe("2 attachments");
  });
});
