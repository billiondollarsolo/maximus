import type { ProviderKind } from "@maximus/domain";
import { assertSafeBaseUrl } from "./ssrf.js";

export type TestConnectionInput = {
  kind: ProviderKind;
  baseUrl?: string | null;
  apiKey?: string | null;
  allowPrivateBaseUrls?: boolean;
  /** Inject for tests */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type TestConnectionResult = {
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
  message?: string;
};

const DEFAULT_OPENAI = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC = "https://api.anthropic.com";

/**
 * Build OpenAI-compatible models list URL from a validated base URL.
 * Strips trailing slashes (same idea as live-http) so `/v1/` and `/v1`
 * both become `.../v1/models`, never `.../v1/v1/models`.
 */
export function openAiModelsUrl(base: URL): string {
  const href = base.href.replace(/\/+$/, "");
  const root = new URL(href);
  let path = root.pathname.replace(/\/+$/, "");
  if (path === "") path = "";
  if (path.endsWith("/models")) {
    root.pathname = path;
    return root.toString();
  }
  if (path.endsWith("/v1")) {
    root.pathname = `${path}/models`;
    return root.toString();
  }
  root.pathname = path === "" || path === "/" ? "/v1/models" : `${path}/v1/models`;
  return root.toString();
}

/**
 * Probe provider credentials with a cheap models/tags list request.
 * Never logs secrets. Timeout default 10s.
 */
export async function testProviderConnection(
  input: TestConnectionInput,
): Promise<TestConnectionResult> {
  const fetchFn = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const started = Date.now();

  try {
    let url: string;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (input.kind === "ollama") {
      if (!input.baseUrl) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          errorCode: "VALIDATION",
          message: "baseUrl required",
        };
      }
      const raw = input.baseUrl.replace(/\/+$/, "");
      assertSafeBaseUrl(raw, {
        allowPrivate: input.allowPrivateBaseUrls ?? false,
      });
      url = `${raw}/api/tags`;
    } else if (input.kind === "anthropic") {
      const raw = (input.baseUrl?.trim() || DEFAULT_ANTHROPIC).replace(
        /\/+$/,
        "",
      );
      assertSafeBaseUrl(raw, {
        allowPrivate: input.allowPrivateBaseUrls ?? false,
      });
      url = `${raw}/v1/models`;
      if (input.apiKey) headers["x-api-key"] = input.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      // openai + openai_compatible
      const raw = input.baseUrl?.trim() || DEFAULT_OPENAI;
      const base = assertSafeBaseUrl(raw, {
        allowPrivate: input.allowPrivateBaseUrls ?? false,
      });
      url = openAiModelsUrl(base);
      if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          errorCode: "PROVIDER_ERROR",
          message: `HTTP ${res.status}`,
        };
      }
      return { ok: true, latencyMs };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const latencyMs = Date.now() - started;
    const msg = err instanceof Error ? err.message : "probe failed";
    const errorCode =
      err instanceof Error && err.name === "AbortError"
        ? "TIMEOUT"
        : msg.includes("Private") || msg.includes("Blocked")
          ? "SSRF"
          : "NETWORK";
    return {
      ok: false,
      latencyMs,
      errorCode,
      message: msg.slice(0, 200),
    };
  }
}
