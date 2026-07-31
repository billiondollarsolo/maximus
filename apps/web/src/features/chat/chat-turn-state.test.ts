import { describe, expect, it } from "vitest";
import {
  chatTurnIsBusy,
  initialChatTurnState,
  reduceChatTurn,
  type ChatTurnState,
} from "./chat-turn-state";

function run(
  events: Parameters<typeof reduceChatTurn>[1][],
  start: ChatTurnState = initialChatTurnState,
): ChatTurnState {
  return events.reduce((s, e) => reduceChatTurn(s, e), start);
}

describe("reduceChatTurn", () => {
  it("send → streaming tokens → done → finalize_done returns to idle", () => {
    const s = run([
      { type: "send", assistantId: "a1" },
      { type: "meta", conversationId: "c1", assistantId: "msg_a" },
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "done" },
      { type: "finalize_done" },
    ]);
    expect(s.phase).toBe("idle");
    expect(s.text).toBe("Hello");
    expect(s.conversationId).toBe("c1");
    expect(s.assistantId).toBe("msg_a");
    expect(chatTurnIsBusy(s)).toBe(false);
  });

  it("send → error leaves error phase with message", () => {
    const s = run([
      { type: "send", assistantId: "a1" },
      { type: "meta", conversationId: "c1" },
      { type: "error", message: "OpenAI-compat error 400: max_tokens" },
    ]);
    expect(s.phase).toBe("error");
    expect(s.errorMessage).toContain("max_tokens");
    expect(chatTurnIsBusy(s)).toBe(false);
  });

  it("send → abort leaves aborted phase", () => {
    const s = run([
      { type: "send", assistantId: "a1" },
      { type: "text", text: "partial" },
      { type: "abort" },
    ]);
    expect(s.phase).toBe("aborted");
    expect(s.text).toBe("partial");
  });

  it("busy while sending/streaming/finalizing", () => {
    expect(chatTurnIsBusy(run([{ type: "send", assistantId: "a" }]))).toBe(
      true,
    );
    expect(
      chatTurnIsBusy(
        run([
          { type: "send", assistantId: "a" },
          { type: "meta", conversationId: "c" },
        ]),
      ),
    ).toBe(true);
    expect(
      chatTurnIsBusy(
        run([
          { type: "send", assistantId: "a" },
          { type: "done" },
        ]),
      ),
    ).toBe(true);
  });

  it("reset clears state", () => {
    const s = run([
      { type: "send", assistantId: "a1" },
      { type: "text", text: "x" },
      { type: "reset" },
    ]);
    expect(s).toEqual(initialChatTurnState);
  });
});
