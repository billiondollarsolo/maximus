import type { ServerMsg } from "./chat-types";

export type ChatSseHandlers = {
  onMeta?: (conversationId: string) => void;
  onText?: (text: string) => void;
  onDone?: (content: string | undefined, status: string | undefined) => void;
};

/** Read SSE body from /api/chat and dispatch events. */
export async function consumeChatSse(
  body: ReadableStream<Uint8Array>,
  handlers: ChatSseHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      try {
        const ev = JSON.parse(json) as {
          type: string;
          conversationId?: string;
          text?: string;
          content?: string;
          status?: string;
        };
        if (ev.type === "meta" && ev.conversationId) {
          handlers.onMeta?.(ev.conversationId);
        }
        if (ev.type === "text" && ev.text) {
          handlers.onText?.(ev.text);
        }
        if (ev.type === "done") {
          handlers.onDone?.(ev.content, ev.status);
        }
      } catch {
        // ignore partial JSON
      }
    }
  }
}

export function appendAssistantText(
  msgs: ServerMsg[],
  tempAsstId: string,
  text: string,
): ServerMsg[] {
  return msgs.map((m) =>
    m.id === tempAsstId
      ? {
          ...m,
          content: [
            {
              type: "text",
              text: (m.content[0]?.text ?? "") + text,
            },
          ],
        }
      : m,
  );
}

export function finalizeAssistant(
  msgs: ServerMsg[],
  tempAsstId: string,
  content: string | undefined,
  status: string | undefined,
): ServerMsg[] {
  return msgs.map((m) =>
    m.id === tempAsstId
      ? {
          ...m,
          content: [
            {
              type: "text",
              text: content ?? m.content[0]?.text ?? "",
            },
          ],
          status: status ?? "complete",
        }
      : m,
  );
}
