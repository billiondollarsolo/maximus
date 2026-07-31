import {
  fakeGeneratedTitle,
  buildRetitleUserPrompt,
  normalizeGeneratedTitle,
  parseModelRef,
  RETITLE_SYSTEM_PROMPT,
  shouldRunAutoRetitle,
  type ProviderKind,
  type TitleSource,
} from "@maximus/domain";
import {
  createFakeTextAdapter,
  createLiveHttpAdapter,
  decryptSecret,
  resolveAdapter,
  type ProviderMessage,
} from "@maximus/provider-gateway";
import type { Db } from "../client.js";
import * as conversationRepo from "../repos/conversations.js";
import * as providerRepo from "../repos/providers.js";
import type { ChatActor, StreamAssistantInput } from "./chat-turn-types.js";

const RETITLE_MAX_TOKENS = 32;
/** Keep short — retitle runs after the user already sees the reply. */
const RETITLE_TIMEOUT_MS = 12_000;

/** Skip giant local models for the title call (would re-load VRAM / hang). */
function isHeavyModelRef(modelRef: string): boolean {
  const id = modelRef.toLowerCase();
  return /(?:^|[^0-9])(?:[2-9]\d|[1-9]\d{2,})b(?:$|[^a-z0-9])/.test(id);
}

export type RetitleResult =
  | { ok: true; title: string }
  | { ok: false; reason: string };

/**
 * After the first assistant reply, replace the heuristic sidebar title with a
 * short LLM-generated one. Never overwrites `title_source=user`. Failures are
 * soft — the heuristic title stays.
 */
export async function retitleConversation(args: {
  db: Db;
  ctx: ChatActor;
  conversationId: string;
  modelRef: string;
  userText: string;
  assistantText: string;
  input: StreamAssistantInput;
}): Promise<RetitleResult> {
  const conv = await conversationRepo.getConversation(
    args.db,
    args.conversationId,
  );
  if (!conv) return { ok: false, reason: "missing_conversation" };
  if (conv.orgId !== args.ctx.orgId || conv.userId !== args.ctx.user.id) {
    return { ok: false, reason: "forbidden" };
  }

  const source = conv.titleSource as TitleSource | null;
  if (!shouldRunAutoRetitle(source)) {
    return { ok: false, reason: "source_blocked" };
  }

  let title: string | null = null;
  const mode = args.input.providerMode ?? "fake";

  try {
    if (mode === "fake") {
      title = normalizeGeneratedTitle(fakeGeneratedTitle(args.userText));
    } else {
      title = await completeRetitleWithModel(args);
      // Soft fallback so sidebar is never stuck on the raw first message
      // when the only available model is huge / retitle timed out.
      if (!title) {
        title = normalizeGeneratedTitle(fakeGeneratedTitle(args.userText));
      }
    }
  } catch {
    title = normalizeGeneratedTitle(fakeGeneratedTitle(args.userText));
  }

  if (!title) return { ok: false, reason: "empty_title" };

  // Re-check before write — user may have renamed during generation.
  const again = await conversationRepo.getConversation(
    args.db,
    args.conversationId,
  );
  if (!again || !shouldRunAutoRetitle(again.titleSource as TitleSource | null)) {
    return { ok: false, reason: "source_blocked" };
  }

  // Avoid no-op "upgrades" that leave the raw first message as the title
  // when the model just echoes the user text (e.g. "hi" → "hi").
  const prev = (again.title ?? "").trim().toLowerCase();
  const next = title.trim().toLowerCase();
  if (prev && prev === next) {
    // Still mark as llm so we do not thrash retitle every turn
    if (again.titleSource !== "llm") {
      await conversationRepo.updateConversation(args.db, args.conversationId, {
        titleSource: "llm",
      });
    }
    return { ok: true, title: again.title ?? title };
  }

  await conversationRepo.updateConversation(args.db, args.conversationId, {
    title,
    titleSource: "llm",
  });

  return { ok: true, title };
}

async function completeRetitleWithModel(args: {
  db: Db;
  ctx: ChatActor;
  modelRef: string;
  userText: string;
  assistantText: string;
  input: StreamAssistantInput;
}): Promise<string | null> {
  // Agents resolve to their base model for inference — retitle uses the same
  // ref path the turn used when possible; strip agent: to base if needed.
  let modelRef = args.modelRef;
  if (modelRef.startsWith("agent:")) {
    // Retitle should not depend on agent presets; use platform fallbacks below.
    modelRef = args.modelRef;
  }

  // Prefer small/fast models. Never re-invoke a 30B+ chat model just for a title.
  const chatRef =
    !modelRef.startsWith("agent:") && !isHeavyModelRef(modelRef)
      ? modelRef
      : null;
  const candidates = uniqueRefs([
    args.input.platform?.openaiApiKey
      ? "openai:platform:gpt-4.1-mini"
      : null,
    args.input.platform?.anthropicApiKey
      ? "anthropic:platform:claude-3-5-haiku-latest"
      : null,
    chatRef,
  ]);
  if (candidates.length === 0) return null;

  const messages: ProviderMessage[] = [
    { role: "system", content: RETITLE_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildRetitleUserPrompt(args.userText, args.assistantText),
    },
  ];

  for (const ref of candidates) {
    try {
      const text = await streamTitleOnce({
        db: args.db,
        ctx: args.ctx,
        modelRef: ref,
        messages,
        input: args.input,
      });
      const normalized = normalizeGeneratedTitle(text);
      if (normalized) return normalized;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function streamTitleOnce(args: {
  db: Db;
  ctx: ChatActor;
  modelRef: string;
  messages: ProviderMessage[];
  input: StreamAssistantInput;
}): Promise<string> {
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
    }
  }

  const resolved = resolveAdapter({
    modelRef: args.modelRef,
    role: args.ctx.role,
    allowlist: [],
    connection,
    platform: args.input.platform,
    allowPrivateBaseUrls: args.input.allowPrivateBaseUrls,
    providerMode: "live",
  });

  const live = resolved.adapter as {
    kind: string;
    modelId: string;
    baseUrl?: string;
    apiKey?: string;
  };
  const adapter =
    live.kind === "fake"
      ? createFakeTextAdapter({ modelId: live.modelId })
      : createLiveHttpAdapter({
          providerKind: live.kind as ProviderKind,
          modelId: live.modelId,
          baseUrl: live.baseUrl ?? resolved.credentials.baseUrl,
          apiKey: live.apiKey ?? resolved.credentials.apiKey,
          maxOutputTokens: RETITLE_MAX_TOKENS,
          temperature: 0.3,
        });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), RETITLE_TIMEOUT_MS);
  try {
    let full = "";
    for await (const chunk of adapter.stream(args.messages, {
      signal: ac.signal,
      maxOutputTokens: RETITLE_MAX_TOKENS,
      temperature: 0.3,
    })) {
      if (chunk.type === "text") full += chunk.text;
    }
    return full;
  } finally {
    clearTimeout(timer);
  }
}

function uniqueRefs(refs: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    if (!r || seen.has(r)) continue;
    seen.add(r);
    out.push(r);
  }
  return out;
}
