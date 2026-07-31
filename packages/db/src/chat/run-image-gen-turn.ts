import {
  AppError,
  canWriteConversation,
  heuristicTitle,
  imagePart,
  isResourceAllowed,
  modelCanGenerateImages,
  parseModelRef,
  textParts,
} from "@maximus/domain";
import {
  decryptSecret,
  generateImage,
  resolveAdapter,
} from "@maximus/provider-gateway";
import type { Db } from "../client.js";
import { newId } from "../ids.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import * as usageRepo from "../repos/usage.js";
import * as attachmentsRepo from "../repos/attachments.js";
import * as providerRepo from "../repos/providers.js";
import { loadAccessForOrg } from "../repos/access-grants.js";
import { listTeamIdsForUser } from "../repos/teams.js";
import type {
  ChatActor,
  ChatTurnEvent,
  StreamAssistantInput,
} from "./chat-turn-types.js";
import { resolveModelCapabilities } from "./resolve-model-capabilities.js";
import { retitleConversation } from "./retitle-conversation.js";

export async function* runImageGenTurn(input: {
  db: Db;
  ctx: ChatActor;
  text: string;
  conversationId?: string;
  modelRef: string;
  projectId?: string | null;
  encryptionKey?: string;
  providerMode?: "live" | "fake";
  platform?: StreamAssistantInput["platform"];
  allowPrivateBaseUrls?: boolean;
  storage?: StreamAssistantInput["storage"];
}): AsyncGenerator<ChatTurnEvent> {
  const prompt = input.text.trim();
  if (!prompt) {
    throw new AppError("VALIDATION", "Prompt required for image generation");
  }

  const caps = await resolveModelCapabilities(
    input.db,
    input.ctx.orgId,
    input.modelRef,
  );
  if (!modelCanGenerateImages(caps)) {
    throw new AppError(
      "VALIDATION",
      "This model cannot generate images. Pick an Image model.",
    );
  }

  let conversation;
  if (input.conversationId) {
    conversation = await conversationRepo.getConversation(
      input.db,
      input.conversationId,
    );
    if (
      !conversation ||
      !canWriteConversation({
        conversationOrgId: conversation.orgId,
        conversationUserId: conversation.userId,
        actorOrgId: input.ctx.orgId,
        actorUserId: input.ctx.user.id,
        actorRole: input.ctx.role,
      })
    ) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }
  } else {
    conversation = await conversationRepo.createConversation(input.db, {
      orgId: input.ctx.orgId,
      userId: input.ctx.user.id,
      modelRef: input.modelRef,
      projectId: input.projectId ?? null,
      title: heuristicTitle(prompt),
      titleSource: "heuristic",
    });
  }

  if (conversation.modelRef !== input.modelRef) {
    const updated = await conversationRepo.updateConversation(
      input.db,
      conversation.id,
      { modelRef: input.modelRef },
    );
    if (updated) conversation = updated;
  }

  const allMsgs = await messageRepo.listMessagesForConversation(
    input.db,
    conversation.id,
  );
  const isFirstUserTurn =
    allMsgs.filter((m) => m.role === "user").length === 0;
  const userMsg = await messageRepo.insertMessage(input.db, {
    conversationId: conversation.id,
    parentMessageId: conversation.activeLeafId,
    role: "user",
    content: textParts(prompt),
    status: "complete",
    position: allMsgs.length,
  });

  const asst = await messageRepo.insertMessage(input.db, {
    conversationId: conversation.id,
    parentMessageId: userMsg.id,
    role: "assistant",
    content: textParts(""),
    status: "streaming",
    modelRef: input.modelRef,
    position: 0,
  });

  yield {
    type: "meta",
    conversationId: conversation.id,
    userMessageId: userMsg.id,
    assistantMessageId: asst.id,
  };
  yield { type: "text", text: "Generating image…" };

  const ref = parseModelRef(input.modelRef);
  let apiKey: string | undefined;
  let baseUrl: string | undefined;
  let connection = null as
    | {
        id: string;
        kind: typeof ref.providerKind;
        baseUrl: string | null;
        apiKey: string;
        isEnabled: boolean;
      }
    | null;

  if (ref.connectionId !== "platform") {
    const conn = await providerRepo.getProviderConnection(
      input.db,
      ref.connectionId,
    );
    if (!conn?.isEnabled) {
      throw new AppError("MODEL_UNAVAILABLE", "Provider connection unavailable");
    }
    if (!input.encryptionKey) {
      throw new AppError(
        "MODEL_UNAVAILABLE",
        "ENCRYPTION_KEY required for BYOK connection",
      );
    }
    apiKey = decryptSecret(conn.credentialsEncrypted, input.encryptionKey);
    baseUrl = conn.baseUrl ?? undefined;
    connection = {
      id: conn.id,
      kind: ref.providerKind,
      baseUrl: conn.baseUrl,
      apiKey,
      isEnabled: conn.isEnabled,
    };
  } else {
    apiKey = input.platform?.openaiApiKey;
  }

  const mode = input.providerMode ?? "fake";
  // Same grant path as text chat — no legacy model_allowlists dual check.
  const [access, teamIds] = await Promise.all([
    loadAccessForOrg(input.db, input.ctx.orgId),
    listTeamIdsForUser(input.db, input.ctx.orgId, input.ctx.user.id),
  ]);
  if (
    !isResourceAllowed({
      accessMode: access.accessMode,
      grants: access.grants,
      orgRole: input.ctx.role,
      userId: input.ctx.user.id,
      teamIds,
      resourceType: "model",
      resourceRef: input.modelRef,
    })
  ) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this model in the current organization",
    );
  }
  resolveAdapter({
    modelRef: input.modelRef,
    role: input.ctx.role,
    allowlist: [],
    platform: input.platform,
    providerMode: mode,
    allowPrivateBaseUrls: input.allowPrivateBaseUrls,
    connection,
  });

  const started = Date.now();
  try {
    const result = await generateImage({
      providerKind: ref.providerKind,
      modelId: ref.modelId,
      prompt,
      apiKey,
      baseUrl,
      mode,
    });

    const attId = newId("att");
    const storageKey =
      input.storage?.attachmentKey(input.ctx.orgId, attId) ??
      `org/${input.ctx.orgId}/att/${attId}`;

    if (input.storage) {
      await input.storage.putObjectBuffer(
        storageKey,
        result.bytes,
        result.mime,
      );
    }

    await attachmentsRepo.createAttachment(input.db, {
      id: attId,
      orgId: input.ctx.orgId,
      uploaderUserId: input.ctx.user.id,
      storageKey,
      filename: `generated-${attId}.png`,
      mime: result.mime,
      sizeBytes: result.bytes.length,
      messageId: asst.id,
      meta: {
        source: "model",
        prompt,
        revisedPrompt: result.revisedPrompt ?? null,
      },
    });

    const contentParts = [
      imagePart({
        attachmentId: attId,
        mime: result.mime,
        source: "model",
        prompt,
        revisedPrompt: result.revisedPrompt,
      }),
    ];

    await messageRepo.updateMessage(input.db, asst.id, {
      status: "complete",
      content: contentParts,
    });
    await conversationRepo.updateConversation(input.db, conversation.id, {
      activeLeafId: asst.id,
      modelRef: input.modelRef,
    });
    await usageRepo.insertUsageEvent(input.db, {
      orgId: input.ctx.orgId,
      userId: input.ctx.user.id,
      conversationId: conversation.id,
      messageId: asst.id,
      modelRef: input.modelRef,
      providerKind: ref.providerKind,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: null,
      latencyMs: Date.now() - started,
      status: "ok",
    });

    yield {
      type: "done",
      status: "complete",
      content: "",
      contentParts,
    };

    if (isFirstUserTurn) {
      const result = await retitleConversation({
        db: input.db,
        ctx: input.ctx,
        conversationId: conversation.id,
        modelRef: input.modelRef,
        userText: prompt,
        assistantText: "Generated an image",
        input: {
          encryptionKey: input.encryptionKey,
          providerMode: input.providerMode,
          platform: input.platform,
          allowPrivateBaseUrls: input.allowPrivateBaseUrls,
        },
      });
      if (result.ok) {
        yield {
          type: "title",
          title: result.title,
          conversationId: conversation.id,
        };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "image gen failed";
    await messageRepo.updateMessage(input.db, asst.id, {
      status: "error",
      content: textParts(""),
      error: { code: "PROVIDER_ERROR", message },
    });
    yield { type: "error", message, code: "PROVIDER_ERROR" };
    yield { type: "done", status: "error", content: "" };
  }
}
