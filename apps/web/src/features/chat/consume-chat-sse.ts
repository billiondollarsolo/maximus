import type { ContentPartUi, GenerationMetricsUi, ServerMsg } from "./chat-types";

export type ChatSseMeta = {
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
};

export type ChatSseHandlers = {
  onMeta?: (meta: ChatSseMeta) => void;
  onText?: (text: string) => void;
  onDone?: (
    content: string | undefined,
    status: string | undefined,
    contentParts?: ContentPartUi[],
    metrics?: GenerationMetricsUi,
  ) => void;
  onTitle?: (title: string, conversationId: string) => void;
  onStatus?: (phase: string, message?: string) => void;
  onError?: (message: string, code?: string) => void;
};

type SseEvent = {
  type: string;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  text?: string;
  content?: string;
  status?: string;
  contentParts?: ContentPartUi[];
  metrics?: GenerationMetricsUi;
  title?: string;
  message?: string;
  code?: string;
  phase?: string;
};

function dispatchSseEvent(ev: SseEvent, handlers: ChatSseHandlers): void {
  if (ev.type === "meta" && ev.conversationId) {
    handlers.onMeta?.({
      conversationId: ev.conversationId,
      userMessageId: ev.userMessageId,
      assistantMessageId: ev.assistantMessageId,
    });
  }
  if (ev.type === "text" && ev.text) {
    handlers.onText?.(ev.text);
  }
  if (ev.type === "done") {
    handlers.onDone?.(
      ev.content,
      ev.status,
      ev.contentParts,
      ev.metrics,
    );
  }
  if (ev.type === "title" && ev.title && ev.conversationId) {
    handlers.onTitle?.(ev.title, ev.conversationId);
  }
  if (ev.type === "status") {
    handlers.onStatus?.(ev.phase ?? "generating", ev.message);
  }
  if (ev.type === "error") {
    handlers.onError?.(
      ev.message ?? "chat failed",
      ev.code,
    );
  }
}

function parseSseBlock(part: string, handlers: ChatSseHandlers): void {
  // SSE comment lines (`: keepalive`) keep the socket warm; ignore them.
  const dataLine = part
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("data:"));
  if (!dataLine) return;
  const json = dataLine.slice(5).trim();
  if (!json) return;
  try {
    dispatchSseEvent(JSON.parse(json) as SseEvent, handlers);
  } catch {
    // ignore partial / non-JSON frames
  }
}

/** Read SSE body from /api/chat and dispatch events. */
export async function consumeChatSse(
  body: ReadableStream<Uint8Array>,
  handlers: ChatSseHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        parseSseBlock(part, handlers);
      }
    }
    // Final frame may lack trailing \n\n
    if (buf.trim()) {
      parseSseBlock(buf, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

/** Map optimistic temp ids to durable server ids from the meta event. */
export function applyChatMetaIds(
  msgs: ServerMsg[],
  temps: { userId?: string; assistantId: string },
  meta: { userMessageId?: string; assistantMessageId?: string },
): ServerMsg[] {
  const userFrom = temps.userId;
  const userTo = meta.userMessageId;
  const asstFrom = temps.assistantId;
  const asstTo = meta.assistantMessageId;
  if (!userTo && !asstTo) return msgs;

  return msgs.map((m) => {
    let id = m.id;
    let parentMessageId = m.parentMessageId;
    if (userFrom && userTo && id === userFrom) id = userTo;
    if (asstTo && id === asstFrom) id = asstTo;
    if (userFrom && userTo && parentMessageId === userFrom) {
      parentMessageId = userTo;
    }
    if (asstFrom && asstTo && parentMessageId === asstFrom) {
      parentMessageId = asstTo;
    }
    if (id === m.id && parentMessageId === m.parentMessageId) return m;
    return { ...m, id, parentMessageId };
  });
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
              text: (m.content.find((p) => p.type === "text")?.text ?? "") + text,
            },
            ...m.content.filter((p) => p.type !== "text"),
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
  contentParts?: ContentPartUi[],
  metrics?: GenerationMetricsUi,
): ServerMsg[] {
  return msgs.map((m) =>
    m.id === tempAsstId
      ? {
          ...m,
          content: contentParts?.length
            ? contentParts
            : [
                {
                  type: "text",
                  text:
                    content ??
                    m.content.find((p) => p.type === "text")?.text ??
                    "",
                },
              ],
          status: status ?? "complete",
          metrics: metrics ?? m.metrics,
          tokenUsage: metrics
            ? {
                input: metrics.inputTokens,
                output: metrics.outputTokens,
                latencyMs: metrics.latencyMs,
                ttftMs: metrics.ttftMs ?? undefined,
                tokensPerSec: metrics.tokensPerSec ?? undefined,
                providerKind: metrics.providerKind,
              }
            : m.tokenUsage,
        }
      : m,
  );
}

export function failAssistant(
  msgs: ServerMsg[],
  assistantId: string,
  message: string,
): ServerMsg[] {
  return msgs.map((m) =>
    m.id === assistantId
      ? {
          ...m,
          status: "error",
          content: [
            {
              type: "text",
              text:
                m.content.find((p) => p.type === "text")?.text ||
                message,
            },
            ...m.content.filter((p) => p.type !== "text"),
          ],
        }
      : m,
  );
}
