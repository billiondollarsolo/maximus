import { describe, expect, it } from "vitest";
import {
  appendAssistantText,
  applyChatMetaIds,
  consumeChatSse,
  failAssistant,
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

describe("consumeChatSse helpers", () => {
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

  it("applyChatMetaIds remaps temp user/assistant and parent links", () => {
    const tree: ServerMsg[] = [
      {
        id: "tmp_u",
        role: "user",
        parentMessageId: "prev",
        position: 0,
        content: [{ type: "text", text: "hi" }],
        status: "complete",
      },
      {
        id: "tmp_a",
        role: "assistant",
        parentMessageId: "tmp_u",
        position: 0,
        content: [{ type: "text", text: "" }],
        status: "streaming",
      },
    ];
    const out = applyChatMetaIds(
      tree,
      { userId: "tmp_u", assistantId: "tmp_a" },
      { userMessageId: "msg_user", assistantMessageId: "msg_asst" },
    );
    expect(out[0]!.id).toBe("msg_user");
    expect(out[1]!.id).toBe("msg_asst");
    expect(out[1]!.parentMessageId).toBe("msg_user");
  });

  it("failAssistant marks error status", () => {
    const out = failAssistant([base], "a1", "boom");
    expect(out[0]!.status).toBe("error");
    expect(out[0]!.content[0]!.text).toBe("Hi");
  });
});

describe("consumeChatSse", () => {
  it("dispatches meta, text, done, title across chunk boundaries", async () => {
    const events: string[] = [];
    await consumeChatSse(
      sseStream([
        'data: {"type":"meta","conversationId":"c1","userMessageId":"u1","assistantMessageId":"a1"}\n\n',
        'data: {"type":"text","text":"Hel"}\n',
        '\ndata: {"type":"text","text":"lo"}\n\ndata: {"type":"done","status":"complete","content":"Hello"}\n\n',
        'data: {"type":"title","title":"Hello Thread","conversationId":"c1"}\n\n',
      ]),
      {
        onMeta: (m) => events.push(`meta:${m.conversationId}:${m.assistantMessageId}`),
        onText: (t) => events.push(`text:${t}`),
        onDone: (c, s) => events.push(`done:${c}:${s}`),
        onTitle: (t, id) => events.push(`title:${id}:${t}`),
      },
    );
    expect(events).toEqual([
      "meta:c1:a1",
      "text:Hel",
      "text:lo",
      "done:Hello:complete",
      "title:c1:Hello Thread",
    ]);
  });

  it("dispatches error events", async () => {
    let err: string | undefined;
    await consumeChatSse(
      sseStream(['data: {"type":"error","message":"no key","code":"PROVIDER_ERROR"}\n\n']),
      { onError: (m) => { err = m; } },
    );
    expect(err).toBe("no key");
  });

  it("parses trailing frame without final blank line", async () => {
    let done = false;
    await consumeChatSse(
      sseStream(['data: {"type":"done","status":"complete","content":"x"}']),
      { onDone: () => { done = true; } },
    );
    expect(done).toBe(true);
  });
});
