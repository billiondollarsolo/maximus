export type ConvRow = { id: string; title: string | null; updatedAt: string };

export type ContentPartUi = {
  type: string;
  text?: string;
  attachmentId?: string;
  mime?: string;
  source?: string;
  prompt?: string;
  filename?: string;
};

export type GenerationMetricsUi = {
  latencyMs: number;
  ttftMs?: number | null;
  inputTokens: number;
  outputTokens: number;
  tokensPerSec?: number | null;
  modelRef: string;
  providerKind: string;
};

export type ServerMsg = {
  id: string;
  role: string;
  parentMessageId: string | null;
  position: number;
  content: ContentPartUi[];
  status: string;
  modelRef?: string | null;
  tokenUsage?: Record<string, number | string | undefined> | null;
  metrics?: GenerationMetricsUi | null;
};

export function metricsFromTokenUsage(
  modelRef: string | null | undefined,
  tokenUsage: Record<string, number | string | undefined> | null | undefined,
): GenerationMetricsUi | null {
  if (!tokenUsage) return null;
  const input = Number(tokenUsage.input ?? 0);
  const output = Number(tokenUsage.output ?? 0);
  const latencyMs = Number(tokenUsage.latencyMs ?? 0);
  if (!latencyMs && !output && !input) return null;
  return {
    latencyMs,
    ttftMs:
      tokenUsage.ttftMs != null ? Number(tokenUsage.ttftMs) : null,
    inputTokens: input,
    outputTokens: output,
    tokensPerSec:
      tokenUsage.tokensPerSec != null
        ? Number(tokenUsage.tokensPerSec)
        : null,
    modelRef: modelRef ?? "",
    providerKind: String(tokenUsage.providerKind ?? ""),
  };
}

export function textFromContent(content: ContentPartUi[]): string {
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
}

export function imagePartsFromContent(content: ContentPartUi[]): ContentPartUi[] {
  return content.filter((p) => p.type === "image" && p.attachmentId);
}
