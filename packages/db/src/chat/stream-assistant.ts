import {
  AppError,
  assembleSystemPrompts,
  computeCostMicros,
  effectiveMaxOutputTokens,
  effectiveNumCtx,
  estimateMessagesTokens,
  isOpenAiMaxTokensUnsupportedError,
  isResourceAllowed,
  modelIdFromRef,
  parseModelRef,
  resolveEffectiveParams,
  shouldRefuseForContext,
  textParts,
  type OpenAiMaxTokenParam,
} from "@maximus/domain";
import { getOrgSettings } from "../repos/org-settings.js";
import {
  createFakeTextAdapter,
  createLiveHttpAdapter,
  decryptSecret,
  resolveAdapter,
  type FakeTextAdapter,
  type ProviderMessage,
} from "@maximus/provider-gateway";
import type { Db } from "../client.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";
import * as usageRepo from "../repos/usage.js";
import * as providerRepo from "../repos/providers.js";
import {
  getAgentPreset,
  resolveAgentForRun,
} from "../repos/agents.js";
import { loadAccessForOrg } from "../repos/access-grants.js";
import { listTeamIdsForUser } from "../repos/teams.js";
import { getCustomInstructions } from "../repos/user-settings.js";
import type { StreamAssistantInput } from "./chat-turn-types.js";
import type { ChatActor, ChatTurnEvent } from "./chat-turn-types.js";
import { resolveModelCapabilities } from "./resolve-model-capabilities.js";

/** Agent picker refs: `agent:{presetId}` — resolved to base model + prompt/params. */
export function isAgentModelRef(modelRef: string): boolean {
  return modelRef.startsWith("agent:") && modelRef.length > "agent:".length;
}

export function agentIdFromModelRef(modelRef: string): string {
  return modelRef.slice("agent:".length);
}

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
  const [access, teamIds] = await Promise.all([
    loadAccessForOrg(args.db, args.ctx.orgId),
    listTeamIdsForUser(args.db, args.ctx.orgId, args.ctx.user.id),
  ]);

  let inferenceModelRef = args.modelRef;
  let agentSystemPrompt: string | null = null;
  let agentParams: Record<string, unknown> | null = null;

  if (isAgentModelRef(args.modelRef)) {
    const agent = await getAgentPreset(
      args.db,
      args.ctx.orgId,
      agentIdFromModelRef(args.modelRef),
    );
    if (!agent) {
      throw new AppError("VALIDATION", "Agent preset not found");
    }
    const base = await providerRepo.getModelByRef(
      args.db,
      args.ctx.orgId,
      agent.baseModelRef,
    );
    const resolvedAgent = resolveAgentForRun({
      agent: {
        name: agent.name,
        baseModelRef: agent.baseModelRef,
        systemPrompt: agent.systemPrompt,
        params: (agent.params ?? {}) as Record<string, unknown>,
        isEnabled: agent.isEnabled,
      },
      baseOffering: base
        ? { modelRef: base.modelRef, isEnabled: base.isEnabled }
        : null,
    });
    if (!resolvedAgent.ok) {
      throw new AppError("VALIDATION", resolvedAgent.error);
    }
    // Allowlist is enforced on the base offering, never bypassed via agent.
    inferenceModelRef = resolvedAgent.baseModelRef;
    agentSystemPrompt = resolvedAgent.systemPrompt;
    agentParams = resolvedAgent.params;
  }

  const ref = parseModelRef(inferenceModelRef);
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

  if (
    !isResourceAllowed({
      accessMode: access.accessMode,
      grants: access.grants,
      orgRole: args.ctx.role,
      userId: args.ctx.user.id,
      teamIds,
      resourceType: "model",
      resourceRef: inferenceModelRef,
    })
  ) {
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this model in the current organization",
    );
  }

  const mode = args.input.providerMode ?? "fake";
  // Access already enforced via grants; pass empty allowlist into adapter resolver.
  const resolved = resolveAdapter({
    modelRef: inferenceModelRef,
    role: args.ctx.role,
    allowlist: [],
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
    agent: agentSystemPrompt ?? undefined,
    userAbout: custom?.aboutUser,
    userPreferred: custom?.preferredResponse,
  });

  const offeringCaps = await resolveModelCapabilities(
    args.db,
    args.ctx.orgId,
    inferenceModelRef,
  );
  const orgSettings = await getOrgSettings(args.db, args.ctx.orgId);
  const orgDefaults =
    orgSettings.modelDefaults && typeof orgSettings.modelDefaults === "object"
      ? (orgSettings.modelDefaults as Record<string, unknown>)
      : null;
  // Conversation override (if present on settings)
  let conversationOverride: Record<string, unknown> | null = null;
  const conv = await conversationRepo.getConversation(
    args.db,
    args.conversationId,
  );
  const convSettings = (conv as { settings?: Record<string, unknown> } | null)
    ?.settings;
  if (
    convSettings?.modelParams &&
    typeof convSettings.modelParams === "object"
  ) {
    conversationOverride = convSettings.modelParams as Record<string, unknown>;
  }

  // Merge agent params over offering, under conversation override.
  const offeringWithAgent = agentParams
    ? { ...offeringCaps, ...agentParams }
    : offeringCaps;

  const caps = resolveEffectiveParams({
    orgDefaults: orgDefaults
      ? {
          contextWindow:
            typeof orgDefaults.contextWindow === "number"
              ? orgDefaults.contextWindow
              : undefined,
          maxOutputTokens:
            typeof orgDefaults.maxOutputTokens === "number"
              ? orgDefaults.maxOutputTokens
              : undefined,
          numCtx:
            typeof orgDefaults.numCtx === "number"
              ? orgDefaults.numCtx
              : undefined,
          temperature:
            typeof orgDefaults.temperature === "number"
              ? orgDefaults.temperature
              : undefined,
          topP:
            typeof orgDefaults.topP === "number" ? orgDefaults.topP : undefined,
        }
      : null,
    offering: offeringWithAgent,
    conversationOverride: conversationOverride
      ? (conversationOverride as never)
      : null,
  });
  const maxOutputTokens = effectiveMaxOutputTokens(caps);
  const numCtx = effectiveNumCtx(caps);

  let openaiMaxTokenParam: OpenAiMaxTokenParam | undefined =
    caps.openaiMaxTokenParam;

  function buildAdapter(tokenParam?: OpenAiMaxTokenParam): FakeTextAdapter {
    if (resolved.adapter.kind === "fake" || mode === "fake") {
      return resolved.adapter.kind === "fake"
        ? resolved.adapter
        : createFakeTextAdapter({ modelId: resolved.modelId });
    }
    const live = resolved.adapter as {
      kind: typeof ref.providerKind;
      modelId: string;
      baseUrl?: string;
      apiKey?: string;
    };
    return createLiveHttpAdapter({
      providerKind: live.kind,
      modelId: live.modelId,
      baseUrl: live.baseUrl ?? resolved.credentials.baseUrl,
      apiKey: live.apiKey ?? resolved.credentials.apiKey,
      maxOutputTokens,
      numCtx,
      temperature: caps.temperature,
      topP: caps.topP,
      topK: caps.topK,
      frequencyPenalty: caps.frequencyPenalty,
      presencePenalty: caps.presencePenalty,
      stop: caps.stop,
      openaiMaxTokenParam: tokenParam,
    });
  }

  let adapter = buildAdapter(openaiMaxTokenParam);

  const messages: ProviderMessage[] = [
    ...system.map((s) => ({ role: "system", content: s })),
    ...args.history,
  ];

  const estimated = estimateMessagesTokens(
    messages.map((m) => ({
      content:
        typeof m.content === "string"
          ? m.content
          : m.content
              .filter((p) => p.type === "text")
              .map((p) => ("text" in p ? p.text : ""))
              .join("\n"),
    })),
  );
  const modelLabel = modelIdFromRef(inferenceModelRef);
  const budgetCheck = shouldRefuseForContext({
    estimatedInputTokens: estimated,
    contextWindow: caps.contextWindow,
    maxOutputTokens,
    modelLabel,
  });
  if (budgetCheck.refuse) {
    throw new AppError(
      "VALIDATION",
      budgetCheck.reason ?? "Prompt exceeds model context window",
    );
  }

  let full = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let firstTokenAt: number | null = null;
  let status: "complete" | "aborted" | "error" = "complete";

  const streamOpts = {
    signal: args.input.signal,
    maxOutputTokens,
    numCtx,
    temperature: caps.temperature,
    topP: caps.topP,
    topK: caps.topK,
    frequencyPenalty: caps.frequencyPenalty,
    presencePenalty: caps.presencePenalty,
    stop: caps.stop,
    openaiMaxTokenParam,
  };

  async function* runStream(
    ad: FakeTextAdapter,
  ): AsyncGenerator<ChatTurnEvent> {
    for await (const chunk of ad.stream(messages, streamOpts)) {
      if (chunk.type === "text") {
        if (firstTokenAt == null) firstTokenAt = Date.now();
        full += chunk.text;
        yield { type: "text", text: chunk.text };
      } else if (chunk.type === "usage") {
        inputTokens = chunk.inputTokens;
        outputTokens = chunk.outputTokens;
      }
    }
  }

  try {
    try {
      yield* runStream(adapter);
    } catch (err) {
      const message = err instanceof Error ? err.message : "provider error";
      // Auto-learn: OpenAI 400 says use max_completion_tokens — persist & retry once.
      if (
        err instanceof Error &&
        err.name !== "AbortError" &&
        isOpenAiMaxTokensUnsupportedError(message) &&
        openaiMaxTokenParam !== "max_completion_tokens" &&
        (ref.providerKind === "openai" ||
          ref.providerKind === "openai_compatible")
      ) {
        openaiMaxTokenParam = "max_completion_tokens";
        streamOpts.openaiMaxTokenParam = openaiMaxTokenParam;
        await providerRepo.mergeModelCapabilitiesByRef(args.db, {
          orgId: args.ctx.orgId,
          modelRef: inferenceModelRef,
          patch: { openaiMaxTokenParam: "max_completion_tokens" },
        });
        adapter = buildAdapter(openaiMaxTokenParam);
        full = "";
        inputTokens = 0;
        outputTokens = 0;
        firstTokenAt = null;
        yield* runStream(adapter);
      } else {
        throw err;
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
        content: textParts(full || message),
        error: { code: "PROVIDER_ERROR", message },
      });
      yield { type: "error", message, code: "PROVIDER_ERROR" };
      yield { type: "done", status, content: full || message };
      return;
    }
  }

  const latencyMs = Date.now() - started;
  const ttftMs =
    firstTokenAt != null ? Math.max(0, firstTokenAt - started) : null;
  // Prefer provider usage; if missing, estimate output from length (~4 chars/token)
  if (!outputTokens && full.length) {
    outputTokens = Math.max(1, Math.round(full.length / 4));
  }
  const tokensPerSec =
    latencyMs > 0 && outputTokens > 0
      ? Math.round((outputTokens / (latencyMs / 1000)) * 10) / 10
      : null;

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

  const metrics = {
    latencyMs,
    ttftMs,
    inputTokens,
    outputTokens,
    tokensPerSec,
    modelRef: args.modelRef,
    providerKind: resolved.providerKind,
  };

  // Persist message + leaf before closing the client stream so a refresh
  // always sees durable content. Usage is best-effort after `done` so a
  // slow billing write cannot leave the UI stuck on a completed turn.
  await messageRepo.updateMessage(args.db, args.assistantId, {
    status,
    content: textParts(full),
    tokenUsage: {
      input: inputTokens,
      output: outputTokens,
      latencyMs,
      ttftMs: ttftMs ?? undefined,
      tokensPerSec: tokensPerSec ?? undefined,
      providerKind: resolved.providerKind,
    },
  });
  await conversationRepo.updateConversation(args.db, args.conversationId, {
    activeLeafId: args.assistantId,
    modelRef: args.modelRef,
  });

  yield { type: "done", status, content: full, metrics };

  try {
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
      latencyMs,
      status: status === "complete" ? "ok" : status,
    });
  } catch {
    // non-fatal: message is already complete for the user
  }
}
