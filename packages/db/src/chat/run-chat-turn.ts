import {
  AppError,
  assertChatTurnInput,
  assertVisionAllowed,
  canWriteConversation,
  conversationTitleFromInput,
  heuristicTitle,
  modelAcceptsImages,
  modelCanGenerateImages,
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
import * as attachmentsRepo from "../repos/attachments.js";
import { buildProviderMessages, toTree } from "./build-provider-messages.js";
import {
  buildProviderMessagesMultimodal,
  type ProviderMessage,
} from "./build-provider-messages-multimodal.js";
import { buildUserContentParts } from "./build-user-content.js";
import type {
  ChatActor,
  ChatTurnEvent,
  ChatTurnInput,
  StreamAssistantInput,
} from "./chat-turn-types.js";
import { streamAssistant } from "./stream-assistant.js";
import { resolveModelCapabilities } from "./resolve-model-capabilities.js";
import { runImageGenTurn } from "./run-image-gen-turn.js";

export type { ChatActor, ChatTurnEvent, ChatTurnInput } from "./chat-turn-types.js";
export { buildProviderMessages } from "./build-provider-messages.js";
export { buildProviderMessagesMultimodal } from "./build-provider-messages-multimodal.js";

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
  resolveImage?: StreamAssistantInput["resolveImage"];
  storage?: StreamAssistantInput["storage"];
}): AsyncGenerator<ChatTurnEvent> {
  const { db, ctx, body } = input;
  void body.clientMessages;

  {
    const capsEarly = await resolveModelCapabilities(
      db,
      ctx.orgId,
      body.modelRef,
    );
    const forceGen = body.interactionMode === "image_gen";
    const genOnly =
      modelCanGenerateImages(capsEarly) && !modelAcceptsImages(capsEarly);
    if (
      (forceGen || genOnly) &&
      body.mode !== "regenerate" &&
      body.mode !== "edit"
    ) {
      yield* runImageGenTurn({
        db,
        ctx,
        text: body.text,
        conversationId: body.conversationId,
        modelRef: body.modelRef,
        projectId: body.projectId,
        encryptionKey: input.encryptionKey,
        providerMode: input.providerMode,
        platform: input.platform,
        allowPrivateBaseUrls: input.allowPrivateBaseUrls,
        storage: input.storage,
      });
      return;
    }
  }

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

  // Stick conversation to the model used on this turn (create or continue).
  if (conversation.modelRef !== body.modelRef) {
    const updated = await conversationRepo.updateConversation(
      db,
      conversation.id,
      { modelRef: body.modelRef },
    );
    if (updated) conversation = updated;
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
    resolveImage: input.resolveImage,
    storage: input.storage,
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
    const history = await buildHistory(
      db,
      ctx.orgId,
      allMsgs,
      userMessageId,
      body.modelRef,
      streamInput,
    );
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

  const caps = await resolveModelCapabilities(db, ctx.orgId, body.modelRef);
  assertVisionAllowed(caps, contentParts);

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
  const history = await buildHistory(
    db,
    ctx.orgId,
    refreshed,
    userMessageId,
    body.modelRef,
    streamInput,
  );

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

async function buildHistory(
  db: Db,
  orgId: string,
  allMsgs: Awaited<
    ReturnType<typeof messageRepo.listMessagesForConversation>
  >,
  leafId: string,
  modelRef: string,
  streamInput: StreamAssistantInput,
): Promise<ProviderMessage[]> {
  const caps = await resolveModelCapabilities(db, orgId, modelRef);
  const hasImages = allMsgs.some((m) => {
    const parts = m.content as Array<{ type: string }>;
    return Array.isArray(parts) && parts.some((p) => p.type === "image");
  });

  if (!hasImages || !modelAcceptsImages(caps)) {
    return buildProviderMessages(allMsgs, leafId);
  }

  const resolveImage =
    streamInput.resolveImage ??
    (async (attachmentId: string) => {
      const row = await attachmentsRepo.getAttachmentForOrg(
        db,
        orgId,
        attachmentId,
      );
      if (!row || !streamInput.storage) return null;
      try {
        const obj = await streamInput.storage.getObjectBuffer(row.storageKey);
        return {
          mime: row.mime,
          dataBase64: obj.body.toString("base64"),
        };
      } catch {
        return null;
      }
    });

  return buildProviderMessagesMultimodal(allMsgs, leafId, resolveImage);
}
