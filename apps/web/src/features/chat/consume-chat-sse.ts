import type { ContentPartUi, GenerationMetricsUi, ServerMsg } from "./chat-types";

export type ChatSseHandlers = {
  onMeta?: (conversationId: string) => void;
  onText?: (text: string) => void;
  onDone?: (
    content: string | undefined,
    status: string | undefined,
    contentParts?: ContentPartUi[],
    metrics?: GenerationMetricsUi,
  ) => void;
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
          contentParts?: ContentPartUi[];
          metrics?: GenerationMetricsUi;
        };
        if (ev.type === "meta" && ev.conversationId) {
          handlers.onMeta?.(ev.conversationId);
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
