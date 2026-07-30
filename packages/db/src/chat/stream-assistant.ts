import {
  AppError,
  assembleSystemPrompts,
  computeCostMicros,
  parseModelRef,
  textParts,
} from "@maximus/domain";
import {
  createFakeTextAdapter,
  createLiveHttpAdapter,
  decryptSecret,
  resolveAdapter,
  type AllowlistRule,
  type FakeTextAdapter,
  type ProviderMessage,
} from "@maximus/provider-gateway";
import type { Db } from "../client.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import * as usageRepo from "../repos/usage.js";
import * as providerRepo from "../repos/providers.js";
import { getCustomInstructions } from "../repos/user-settings.js";
import type { StreamAssistantInput } from "./chat-turn-types.js";
import type { ChatActor, ChatTurnEvent } from "./chat-turn-types.js";

export async function* streamAssistant(args: {
  db: Db;
  ctx: ChatActor;
  conversationId: string;
  assistantId: string;
  modelRef: string;
  history: ProviderMessage[];
  input: StreamAssistantInput;
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

  const custom = await getCustomInstructions(args.db, {
    userId: args.ctx.user.id,
    orgId: args.ctx.orgId,
  });
  const system = assembleSystemPrompts({
    platform: "You are Maximus, a helpful enterprise assistant.",
    userAbout: custom?.aboutUser,
    userPreferred: custom?.preferredResponse,
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

  const messages: ProviderMessage[] = [
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
    modelRef: args.modelRef,
  });
  const costMicros = computeCostMicros({
    inputTokens,
    outputTokens,
    price: price
      ? {
          inputUsdPer1m: price.inputUsdPer1m,
          outputUsdPer1m: price.outputUsdPer1m,
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
