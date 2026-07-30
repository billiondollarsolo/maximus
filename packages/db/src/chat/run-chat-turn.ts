import {
  AppError,
  assertChatTurnInput,
  canWriteConversation,
  conversationTitleFromInput,
  heuristicTitle,
  planEditFork,
  planRegenerate,
  planSend,
  textParts,
} from "@maximus/domain";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../client.js";
import { attachments } from "../schema/index.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import { buildProviderMessages, toTree } from "./build-provider-messages.js";
import { buildUserContentParts } from "./build-user-content.js";
import type {
  ChatActor,
  ChatTurnEvent,
  ChatTurnInput,
  StreamAssistantInput,
} from "./chat-turn-types.js";
import { streamAssistant } from "./stream-assistant.js";

export type { ChatActor, ChatTurnEvent, ChatTurnInput } from "./chat-turn-types.js";
export { buildProviderMessages } from "./build-provider-messages.js";

/**
 * Server-authoritative chat turn: rebuilds history from DB, never trusts clientMessages.
 */
export async function* runChatTurn(input: {
  db: Db;
  ctx: ChatActor;
  body: ChatTurnInput;
  encryptionKey?: string;
  providerMode?: "live" | "fake";
  platform?: StreamAssistantInput["platform"];
  allowPrivateBaseUrls?: boolean;
  signal?: AbortSignal;
}): AsyncGenerator<ChatTurnEvent> {
  const { db, ctx, body } = input;
  void body.clientMessages; // never used for history

  const normalized = assertChatTurnInput({
    text: body.text,
    attachmentIds: body.attachmentIds,
    mode: body.mode,
    targetMessageId: body.targetMessageId,
  });
  const mode = normalized.mode;

  let conversation;
  if (body.conversationId != null) {
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
    const titleSourceText = conversationTitleFromInput(normalized);
    conversation = await conversationRepo.createConversation(db, {
      orgId: ctx.orgId,
      userId: ctx.user.id,
      modelRef: body.modelRef,
      projectId: body.projectId ?? null,
      title: heuristicTitle(titleSourceText),
      titleSource: "heuristic",
    });
  }

  const allMsgs = await messageRepo.listMessagesForConversation(
    db,
    conversation.id,
  );
  const tree = toTree(allMsgs);
  const streamInput: StreamAssistantInput = {
    encryptionKey: input.encryptionKey,
    providerMode: input.providerMode,
    platform: input.platform,
    allowPrivateBaseUrls: input.allowPrivateBaseUrls,
    signal: input.signal,
  };

  if (mode === "regenerate") {
    const plan = planRegenerate(tree, normalized.targetMessageId!);
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
    const history = buildProviderMessages(allMsgs, userMessageId);
    yield* streamAssistant({
      db,
      ctx,
      conversationId: conversation.id,
      assistantId: asst.id,
      modelRef: body.modelRef,
      history,
      input: streamInput,
    });
    return;
  }

  const contentParts = await buildUserContentParts(
    db,
    ctx,
    normalized.text,
    normalized.attachmentIds,
  );

  let userMessageId: string;
  let parentForAssistant: string;

  if (mode === "edit") {
    const plan = planEditFork(tree, normalized.targetMessageId!);
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

  if (normalized.attachmentIds.length) {
    await db
      .update(attachments)
      .set({ messageId: userMessageId })
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          inArray(attachments.id, normalized.attachmentIds),
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
    input: streamInput,
  });
}
