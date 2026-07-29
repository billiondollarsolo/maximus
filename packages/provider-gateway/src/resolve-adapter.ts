import {
  AppError,
  parseModelRef,
  serializeModelRef,
  type ModelRef,
} from "@maximus/domain";
import { isModelAllowed } from "./allowlist.js";
import { createFakeTextAdapter } from "./adapters/fake-adapter.js";
import { assertSafeBaseUrl } from "./ssrf.js";
import type { ResolveAdapterInput, ResolvedAdapter } from "./types.js";

function asRef(input: string | ModelRef): ModelRef {
  return typeof input === "string" ? parseModelRef(input) : input;
}

/**
 * Resolve model ref → credentials + adapter descriptor.
 * Live TanStack adapters are constructed at the chat boundary when not fake.
 */
export function resolveAdapter(input: ResolveAdapterInput): ResolvedAdapter {
  const ref = asRef(input.modelRef);
  const modelRefStr = serializeModelRef(ref);

  if (!isModelAllowed(input.role, modelRefStr, input.allowlist)) {
    throw new AppError("MODEL_UNAVAILABLE", "Model not allowed for your role");
  }

  const mode =
    input.providerMode ??
    (process.env.PROVIDER_MODE === "fake" ? "fake" : "live");

  if (mode === "fake") {
    return {
      modelRef: modelRefStr,
      providerKind: ref.providerKind,
      modelId: ref.modelId,
      credentials: { source: "platform" },
      adapter: createFakeTextAdapter({ modelId: ref.modelId }),
    };
  }

  let apiKey: string | undefined;
  let baseUrl: string | undefined;
  let source: "platform" | "byok" = "platform";

  if (ref.connectionId !== "platform") {
    const conn = input.connection;
    if (!conn || !conn.isEnabled) {
      throw new AppError("MODEL_UNAVAILABLE", "Provider connection unavailable");
    }
    if (conn.kind !== ref.providerKind) {
      throw new AppError("VALIDATION", "Connection kind mismatch");
    }
    apiKey = conn.apiKey;
    baseUrl = conn.baseUrl ?? undefined;
    source = "byok";
  } else {
    const p = input.platform ?? {};
    if (ref.providerKind === "openai" || ref.providerKind === "openai_compatible") {
      apiKey = p.openaiApiKey;
    } else if (ref.providerKind === "anthropic") {
      apiKey = p.anthropicApiKey;
    } else if (ref.providerKind === "ollama") {
      baseUrl = p.ollamaBaseUrl ?? "http://127.0.0.1:11434";
    }
  }

  if (
    (ref.providerKind === "openai" ||
      ref.providerKind === "openai_compatible" ||
      ref.providerKind === "anthropic") &&
    !apiKey
  ) {
    throw new AppError("MODEL_UNAVAILABLE", "Missing API credentials for model");
  }

  if (baseUrl) {
    assertSafeBaseUrl(baseUrl, {
      allowPrivate: input.allowPrivateBaseUrls ?? false,
    });
  }

  if (ref.providerKind === "ollama" && !baseUrl) {
    throw new AppError("MODEL_UNAVAILABLE", "Ollama base URL required");
  }

  return {
    modelRef: modelRefStr,
    providerKind: ref.providerKind,
    modelId: ref.modelId,
    credentials: { apiKey, baseUrl, source },
    adapter: {
      kind: ref.providerKind,
      modelId: ref.modelId,
      baseUrl,
      apiKey,
    },
  };
}
