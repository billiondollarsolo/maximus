import {
  AppError,
  assembleSystemPrompts,
  canWriteConversation,
  computeCostMicros,
  heuristicTitle,
  listActiveBranch,
  parseModelRef,
  planEditFork,
  planRegenerate,
  planSend,
  textParts,
  type ContentPart,
  type OrgRole,
  type TreeMessage,
} from "@maximus/domain";
import {
  createFakeTextAdapter,
  createLiveHttpAdapter,
  decryptSecret,
  resolveAdapter,
  type AllowlistRule,
  type FakeTextAdapter,
} from "@maximus/provider-gateway";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../client.js";
import { attachments } from "../schema/index.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import * as usageRepo from "../repos/usage.js";
import * as providerRepo from "../repos/providers.js";

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
  | { type: "done"; status: "complete" | "aborted" | "error"; content: string }
  | { type: "error"; message: string; code?: string };

type MsgRow = Awaited<
  ReturnType<typeof messageRepo.listMessagesForConversation>
>[number];

/**
 * Server-authoritative chat turn: rebuilds history from DB, never trusts clientMessages.
 */
export async function* runChatTurn(input: {
  db: Db;
  ctx: ChatActor;
  body: ChatTurnInput;
  encryptionKey?: string;
  providerMode?: "live" | "fake";
  platform?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaBaseUrl?: string;
  };
  allowPrivateBaseUrls?: boolean;
  signal?: AbortSignal;
}): AsyncGenerator<ChatTurnEvent> {
  const { db, ctx, body } = input;
  void body.clientMessages; // never used for history
  if (!body.text?.trim() && body.mode !== "regenerate") {
    throw new AppError("VALIDATION", "Message text required");
  }

  let conversation;
  if (body.conversationId != null) {
    // Provided id must exist and be writable — never silently create
    conversation = await conversationRepo.getConversation(
      db,
      body.conversationId,
    );
    if (
      !conversation ||
      !canWriteConversation({
        conversationOrgId: conversation.orgId,
        conversationUserId: conversation.userId,
        actorOrgId: ctx.orgId,
        actorUserId: ctx.user.id,
        actorRole: ctx.role,
      })
    ) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }
  } else {
    conversation = await conversationRepo.createConversation(db, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      modelRef: body.modelRef,
      projectId: body.projectId ?? null,
      title: heuristicTitle(body.text),
      titleSource: "heuristic",
    });
  }

  const allMsgs = await messageRepo.listMessagesForConversation(
    db,
    conversation.id,
  );
  const tree = toTree(allMsgs);
  const mode = body.mode ?? "send";

  if (mode === "regenerate") {
    if (!body.targetMessageId) {
      throw new AppError("VALIDATION", "targetMessageId required for regenerate");
    }
    const plan = planRegenerate(tree, body.targetMessageId);
    const userMessageId = plan.parentMessageId;
    const asst = await messageRepo.insertMessage(db, {
      conversationId: conversation.id,
      parentMessageId: plan.parentMessageId,
      role: "assistant",
      content: textParts(""),
      status: "streaming",
      modelRef: body.modelRef,
      position: plan.position,
    });
    yield {
      type: "meta",
      conversationId: conversation.id,
      userMessageId,
      assistantMessageId: asst.id,
    };
    // History = path to parent user message (includes that user turn, not prior assistants siblings)
    const history = buildProviderMessages(allMsgs, userMessageId);
    yield* streamAssistant({
      db,
      ctx,
      conversationId: conversation.id,
      assistantId: asst.id,
      modelRef: body.modelRef,
      history,
      input,
    });
    return;
  }

  const contentParts = await buildUserContentParts(db, ctx, body);

  let userMessageId: string;
  let parentForAssistant: string;

  if (mode === "edit") {
    if (!body.targetMessageId) {
      throw new AppError("VALIDATION", "targetMessageId required for edit");
    }
    const plan = planEditFork(tree, body.targetMessageId);
    const userMsg = await messageRepo.insertMessage(db, {
      conversationId: conversation.id,
      parentMessageId: plan.parentMessageId,
      role: "user",
      content: contentParts,
      status: "complete",
      position: plan.position,
    });
    userMessageId = userMsg.id;
    parentForAssistant = userMsg.id;
  } else {
    const plan = planSend(tree, conversation.activeLeafId);
    const userMsg = await messageRepo.insertMessage(db, {
      conversationId: conversation.id,
      parentMessageId: plan.parentMessageId,
      role: "user",
      content: contentParts,
      status: "complete",
      position: plan.position,
    });
    userMessageId = userMsg.id;
    parentForAssistant = userMsg.id;
  }

  // link attachments to this user message
  if (body.attachmentIds?.length) {
    await db
      .update(attachments)
      .set({ messageId: userMessageId })
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          inArray(attachments.id, body.attachmentIds),
        ),
      );
  }

  const asst = await messageRepo.insertMessage(db, {
    conversationId: conversation.id,
    parentMessageId: parentForAssistant,
    role: "assistant",
    content: textParts(""),
    status: "streaming",
    modelRef: body.modelRef,
    position: 0,
  });

  yield {
    type: "meta",
    conversationId: conversation.id,
    userMessageId,
    assistantMessageId: asst.id,
  };

  const refreshed = await messageRepo.listMessagesForConversation(
    db,
    conversation.id,
  );
  const history = buildProviderMessages(refreshed, userMessageId);

  yield* streamAssistant({
    db,
    ctx,
    conversationId: conversation.id,
    assistantId: asst.id,
    modelRef: body.modelRef,
    history,
    input,
  });
}

async function buildUserContentParts(
  db: Db,
  ctx: ChatActor,
  body: ChatTurnInput,
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [];
  if (body.text?.trim()) parts.push({ type: "text", text: body.text });
  if (body.attachmentIds?.length) {
    const rows = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          inArray(attachments.id, body.attachmentIds),
        ),
      );
    for (const a of rows) {
      if (a.mime.startsWith("image/")) {
        parts.push({ type: "image", attachmentId: a.id, mime: a.mime });
      } else {
        parts.push({
          type: "file",
          attachmentId: a.id,
          mime: a.mime,
          filename: a.filename,
        });
      }
    }
  }
  if (parts.length === 0) {
    throw new AppError("VALIDATION", "Message text or attachments required");
  }
  return parts;
}

function toTree(allMsgs: MsgRow[]): TreeMessage[] {
  return allMsgs.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as TreeMessage["role"],
    position: m.position,
  }));
}

/**
 * Linearize active branch up to and including leafId (usually the latest user msg).
 * Provider messages include multimodal as text notes for non-vision fallbacks.
 */
export function buildProviderMessages(
  allMsgs: MsgRow[],
  leafId: string,
): Array<{ role: string; content: string }> {
  const tree = toTree(allMsgs);
  const branch = listActiveBranch(tree, leafId);
  return branch.map((m) => {
    const full = allMsgs.find((x) => x.id === m.id)!;
    const parts = (full.content as ContentPart[]) ?? [];
    const text = contentPartsToProviderText(parts);
    return { role: m.role, content: text };
  });
}

function contentPartsToProviderText(parts: ContentPart[]): string {
  const bits: string[] = [];
  for (const p of parts) {
    if (p.type === "text") bits.push(p.text);
    else if (p.type === "image")
      bits.push(`[image attachment:${p.attachmentId} mime:${p.mime}]`);
    else bits.push(`[file ${p.filename} attachment:${p.attachmentId}]`);
  }
  return bits.join("\n");
}

async function* streamAssistant(args: {
  db: Db;
  ctx: ChatActor;
  conversationId: string;
  assistantId: string;
  modelRef: string;
  history: Array<{ role: string; content: string }>;
  input: {
    encryptionKey?: string;
    providerMode?: "live" | "fake";
    platform?: {
      openaiApiKey?: string;
      anthropicApiKey?: string;
      ollamaBaseUrl?: string;
    };
    allowPrivateBaseUrls?: boolean;
    signal?: AbortSignal;
  };
}): AsyncGenerator<ChatTurnEvent> {
  const started = Date.now();
  const allowRows = await providerRepo.listAllowlist(args.db, args.ctx.orgId);
  const allowlist: AllowlistRule[] = allowRows.map((r) => ({
    modelRef: r.modelRef,
    role: (r.role as AllowlistRule["role"]) ?? null,
  }));

  const ref = parseModelRef(args.modelRef);
  let connection = null;
  if (ref.connectionId !== "platform") {
    const conn = await providerRepo.getProviderConnection(
      args.db,
      ref.connectionId,
    );
    if (conn && args.input.encryptionKey) {
      connection = {
        id: conn.id,
        kind: conn.kind as typeof ref.providerKind,
        baseUrl: conn.baseUrl,
        apiKey: decryptSecret(
          conn.credentialsEncrypted,
          args.input.encryptionKey,
        ),
        isEnabled: conn.isEnabled,
      };
    } else if (conn && !args.input.encryptionKey) {
      throw new AppError(
        "MODEL_UNAVAILABLE",
        "ENCRYPTION_KEY required for BYOK connection",
      );
    }
  }

  const mode = args.input.providerMode ?? "fake";
  const resolved = resolveAdapter({
    modelRef: args.modelRef,
    role: args.ctx.role,
    allowlist,
    connection,
    platform: args.input.platform,
    allowPrivateBaseUrls: args.input.allowPrivateBaseUrls,
    providerMode: mode,
  });

  const system = assembleSystemPrompts({
    platform: "You are Maximus, a helpful enterprise assistant.",
  });

  let adapter: FakeTextAdapter;
  if (resolved.adapter.kind === "fake" || mode === "fake") {
    adapter =
      resolved.adapter.kind === "fake"
        ? resolved.adapter
        : createFakeTextAdapter({ modelId: resolved.modelId });
  } else {
    const live = resolved.adapter as {
      kind: typeof ref.providerKind;
      modelId: string;
      baseUrl?: string;
      apiKey?: string;
    };
    adapter = createLiveHttpAdapter({
      providerKind: live.kind,
      modelId: live.modelId,
      baseUrl: live.baseUrl ?? resolved.credentials.baseUrl,
      apiKey: live.apiKey ?? resolved.credentials.apiKey,
    });
  }

  const messages = [
    ...system.map((s) => ({ role: "system", content: s })),
    ...args.history,
  ];

  let full = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let status: "complete" | "aborted" | "error" = "complete";

  try {
    for await (const chunk of adapter.stream(messages, {
      signal: args.input.signal,
    })) {
      if (chunk.type === "text") {
        full += chunk.text;
        yield { type: "text", text: chunk.text };
      } else if (chunk.type === "usage") {
        inputTokens = chunk.inputTokens;
        outputTokens = chunk.outputTokens;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      status = "aborted";
    } else {
      status = "error";
      const message = err instanceof Error ? err.message : "provider error";
      await messageRepo.updateMessage(args.db, args.assistantId, {
        status: "error",
        content: textParts(full),
        error: { code: "PROVIDER_ERROR", message },
      });
      yield { type: "error", message, code: "PROVIDER_ERROR" };
      yield { type: "done", status, content: full };
      return;
    }
  }

  const price = await usageRepo.findPrice(args.db, {
    orgId: args.ctx.orgId,
    providerKind: resolved.providerKind,
    modelId: resolved.modelId,
  });
  const costMicros = computeCostMicros({
    inputTokens,
    outputTokens,
    price: price
      ? {
          inputUsdPer1m: Number(price.inputUsdPer1m),
          outputUsdPer1m: Number(price.outputUsdPer1m),
        }
      : null,
  });

  await messageRepo.updateMessage(args.db, args.assistantId, {
    status,
    content: textParts(full),
    tokenUsage: { input: inputTokens, output: outputTokens },
  });
  await conversationRepo.updateConversation(args.db, args.conversationId, {
    activeLeafId: args.assistantId,
    modelRef: args.modelRef,
  });
  await usageRepo.insertUsageEvent(args.db, {
    orgId: args.ctx.orgId,
    userId: args.ctx.user.id,
    conversationId: args.conversationId,
    messageId: args.assistantId,
    modelRef: args.modelRef,
    providerKind: resolved.providerKind,
    inputTokens,
    outputTokens,
    costMicros,
    latencyMs: Date.now() - started,
    status: status === "complete" ? "ok" : status,
  });

  yield { type: "done", status, content: full };
}
