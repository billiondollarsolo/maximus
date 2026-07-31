import type { ContentPart, OrgRole } from "@maximus/domain";

export type ChatActor = {
  user: { id: string; email: string; name: string };
  orgId: string;
  role: OrgRole;
};

export type ChatTurnInput = {
  text: string;
  attachmentIds?: string[];
  conversationId?: string;
  modelRef: string;
  projectId?: string;
  mode?: "send" | "regenerate" | "edit";
  /** chat (default) vs image generation */
  interactionMode?: "chat" | "image_gen";
  targetMessageId?: string;
  /** Client-supplied prior messages — IGNORED (server-authoritative). */
  clientMessages?: unknown;
};

export type ChatTurnEvent =
  | {
      type: "meta";
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
    }
  | { type: "text"; text: string }
  | {
      type: "done";
      status: "complete" | "aborted" | "error";
      content: string;
      contentParts?: ContentPart[];
      /** Generation stats (OpenWebUI-style footer) */
      metrics?: GenerationMetrics;
    }
  /** LLM (or fake) sidebar title after first assistant reply */
  | { type: "title"; title: string; conversationId: string }
  | { type: "error"; message: string; code?: string };

export type GenerationMetrics = {
  latencyMs: number;
  /** Time to first token (streaming) */
  ttftMs?: number | null;
  inputTokens: number;
  outputTokens: number;
  /** outputTokens / (latencyMs/1000) when latency > 0 */
  tokensPerSec?: number | null;
  modelRef: string;
  providerKind: string;
};

export type StreamAssistantInput = {
  encryptionKey?: string;
  providerMode?: "live" | "fake";
  platform?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaBaseUrl?: string;
  };
  allowPrivateBaseUrls?: boolean;
  signal?: AbortSignal;
  /** Optional S3-like resolver for vision images */
  resolveImage?: (
    attachmentId: string,
  ) => Promise<{ mime: string; dataBase64: string } | null>;
  storage?: {
    getObjectBuffer: (
      key: string,
    ) => Promise<{ body: Buffer; contentType?: string }>;
    putObjectBuffer: (
      key: string,
      body: Buffer,
      contentType: string,
    ) => Promise<void>;
    attachmentKey: (orgId: string, attachmentId: string) => string;
  };
};
