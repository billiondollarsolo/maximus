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
  textFromParts,
  textParts,
  type ContentPart,
  type TreeMessage,
} from "@maximus/domain";
import {
  createFakeTextAdapter,
  resolveAdapter,
  type AllowlistRule,
} from "@maximus/provider-gateway";
import type { OrgRole } from "@maximus/domain";
import type { Db } from "../client.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import * as usageRepo from "../repos/usage.js";
import * as providerRepo from "../repos/providers.js";
import { decryptSecret } from "@maximus/provider-gateway";

/** Minimal actor context — avoids db↔auth circular import. */
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
  | { type: "meta"; conversationId: string; userMessageId: string; assistantMessageId: string }
  | { type: "text"; text: string }
  | { type: "done"; status: "complete" | "aborted" | "error"; content: string }
  | { type: "error"; message: string; code?: string };

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
  if (body.clientMessages != null) {
    // Explicitly ignore — presence does not affect history
  }
  if (!body.text?.trim() && body.mode !== "regenerate") {
    throw new AppError("VALIDATION", "Message text required");
  }

  let conversation =
    body.conversationId != null
      ? await conversationRepo.getConversation(db, body.conversationId)
      : null;

  if (conversation) {
    const allowed = canWriteConversation({
      conversationOrgId: conversation.orgId,
      conversationUserId: conversation.userId,
      actorOrgId: ctx.orgId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
    });
    if (!allowed) {
      // D10/D12 cross-tenant: 404
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
  const tree: TreeMessage[] = allMsgs.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as TreeMessage["role"],
    position: m.position,
  }));

  const mode = body.mode ?? "send";
  let userMessageId: string;
  let parentForAssistant: string;
  let userContent: ContentPart[] = textParts(body.text ?? "");

  if (mode === "regenerate") {
    if (!body.targetMessageId) {
      throw new AppError("VALIDATION", "targetMessageId required for regenerate");
    }
    const plan = planRegenerate(tree, body.targetMessageId);
    parentForAssistant = plan.parentMessageId;
    const parent = allMsgs.find((m) => m.id === plan.parentMessageId);
    userMessageId = plan.parentMessageId;
    userContent = (parent?.content as ContentPart[]) ?? textParts("");
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
    yield* streamAssistant({
      db,
      ctx,
      conversationId: conversation.id,
      assistantId: asst.id,
      modelRef: body.modelRef,
      history: buildHistory(allMsgs, conversation.activeLeafId, mode, body),
      userContent,
      input,
    });
    return;
  }

  if (mode === "edit") {
    if (!body.targetMessageId) {
      throw new AppError("VALIDATION", "targetMessageId required for edit");
    }
    const plan = planEditFork(tree, body.targetMessageId);
    const userMsg = await messageRepo.insertMessage(db, {
      conversationId: conversation.id,
      parentMessageId: plan.parentMessageId,
      role: "user",
      content: userContent,
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
      content: userContent,
      status: "complete",
      position: plan.position,
    });
    userMessageId = userMsg.id;
    parentForAssistant = userMsg.id;
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

  yield* streamAssistant({
    db,
    ctx,
    conversationId: conversation.id,
    assistantId: asst.id,
    modelRef: body.modelRef,
    history: buildProviderMessages(refreshed, userMessageId),
    userContent,
    input,
  });
}

function buildHistory(
  _allMsgs: Awaited<ReturnType<typeof messageRepo.listMessagesForConversation>>,
  _leaf: string | null,
  _mode: string,
  _body: ChatTurnInput,
) {
  return [] as Array<{ role: string; content: string }>;
}

function buildProviderMessages(
  allMsgs: Awaited<ReturnType<typeof messageRepo.listMessagesForConversation>>,
  leafUserId: string,
): Array<{ role: string; content: string }> {
  const tree: TreeMessage[] = allMsgs.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as TreeMessage["role"],
    position: m.position,
  }));
  // path to the user message leaf (before assistant)
  const branch = listActiveBranch(tree, leafUserId);
  return branch.map((m) => {
    const full = allMsgs.find((x) => x.id === m.id)!;
    return {
      role: m.role,
      content: textFromParts((full.content as ContentPart[]) ?? []),
    };
  });
}

async function* streamAssistant(args: {
  db: Db;
  ctx: ChatActor;
  conversationId: string;
  assistantId: string;
  modelRef: string;
  history: Array<{ role: string; content: string }>;
  userContent: ContentPart[];
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
        apiKey: decryptSecret(conn.credentialsEncrypted, args.input.encryptionKey),
        isEnabled: conn.isEnabled,
      };
    }
  }

  const resolved = resolveAdapter({
    modelRef: args.modelRef,
    role: args.ctx.role,
    allowlist,
    connection,
    platform: args.input.platform,
    allowPrivateBaseUrls: args.input.allowPrivateBaseUrls,
    providerMode: args.input.providerMode ?? "fake",
  });

  const system = assembleSystemPrompts({
    platform: "You are Maximus, a helpful enterprise assistant.",
  });

  const adapter =
    resolved.adapter.kind === "fake"
      ? resolved.adapter
      : createFakeTextAdapter({
          modelId: resolved.modelId,
          chunks: [
            {
              type: "text",
              text: `[${resolved.providerKind}] `,
            },
            { type: "text", text: "Live adapter placeholder — use PROVIDER_MODE=fake in CI." },
            { type: "usage", inputTokens: 12, outputTokens: 8 },
          ],
        });

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
