import { describe, expect, it } from "vitest";
import {
  appendAssistantText,
  consumeChatSse,
  type ChatSseHandlers,
} from "./consume-chat-sse";
import type { ServerMsg } from "./chat-types";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(chunks[i++]));
    },
  });
}

/**
 * Progressive-stream proof: real consumeChatSse + appendAssistantText must
 * produce ≥3 intermediate assistant text lengths strictly before done.
 */
describe("progressive stream consumption (shipped path)", () => {
  it("yields at least 3 intermediate text lengths before done", async () => {
    const lengths: number[] = [];
    let msgs: ServerMsg[] = [
      {
        id: "a1",
        role: "assistant",
        parentMessageId: "u1",
        position: 0,
        content: [{ type: "text", text: "" }],
        status: "streaming",
      },
    ];
    let doneSeen = false;
    let lengthsAtDone = 0;

    const handlers: ChatSseHandlers = {
      onText: (t) => {
        expect(doneSeen).toBe(false);
        msgs = appendAssistantText(msgs, "a1", t);
        const text =
          msgs[0]!.content.find((p) => p.type === "text")?.text ?? "";
        lengths.push(text.length);
      },
      onDone: () => {
        doneSeen = true;
        lengthsAtDone = lengths.length;
      },
    };

    await consumeChatSse(
      sseStream([
        'data: {"type":"meta","conversationId":"c1","userMessageId":"u1","assistantMessageId":"a1"}\n\n',
        'data: {"type":"text","text":"One"}\n\n',
        'data: {"type":"text","text":" two"}\n\n',
        'data: {"type":"text","text":" three"}\n\n',
        'data: {"type":"text","text":" four"}\n\n',
        'data: {"type":"done","status":"complete","content":"One two three four"}\n\n',
      ]),
      handlers,
    );

    expect(doneSeen).toBe(true);
    // All text events processed before done handler ran
    expect(lengthsAtDone).toBeGreaterThanOrEqual(3);
    // Distinct intermediate lengths strictly increasing before terminal
    const unique = [...new Set(lengths)];
    expect(unique.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]!).toBeGreaterThan(lengths[i - 1]!);
    }
    expect(lengths[lengths.length - 1]).toBe("One two three four".length);
  });
});
