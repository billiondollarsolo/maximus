import { assertSafeBaseUrl } from "./ssrf.js";
import { isEmbeddingModelName } from "@maximus/domain";

export type ShowOllamaModelInput = {
  baseUrl: string;
  name: string;
  allowPrivateBaseUrls?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type OllamaModelDetails = {
  name: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  contextWindow?: number;
  isEmbed: boolean;
};

/**
 * Ollama POST /api/show — extract context length and family hints.
 */
export async function showOllamaModel(
  input: ShowOllamaModelInput,
): Promise<OllamaModelDetails | null> {
  const fetchFn = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const raw = input.baseUrl.trim().replace(/\/+$/, "");
  const name = input.name.trim();
  if (!raw || !name) return null;

  try {
    assertSafeBaseUrl(raw, {
      allowPrivate: input.allowPrivateBaseUrls ?? false,
    });
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${raw}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      details?: {
        family?: string;
        families?: string[];
        parameter_size?: string;
        quantization_level?: string;
      };
      model_info?: Record<string, unknown>;
      parameters?: string;
    };

    const family =
      body.details?.family ??
      body.details?.families?.[0] ??
      undefined;
    const parameterSize = body.details?.parameter_size;
    const quantization = body.details?.quantization_level;
    let contextWindow: number | undefined;

    // model_info keys vary: "llama.context_length", "gemma.context_length", etc.
    if (body.model_info && typeof body.model_info === "object") {
      for (const [k, v] of Object.entries(body.model_info)) {
        if (/context.?length$/i.test(k) && typeof v === "number" && v > 0) {
          contextWindow = Math.floor(v);
          break;
        }
      }
    }
    // parameters string may contain "num_ctx 8192"
    if (contextWindow == null && typeof body.parameters === "string") {
      const m = /\bnum_ctx\s+(\d+)/i.exec(body.parameters);
      if (m?.[1]) contextWindow = Number(m[1]);
    }

    const isEmbed =
      isEmbeddingModelName(name) ||
      (family != null && /bert|nomic|embed/i.test(family));

    return {
      name,
      family,
      parameterSize,
      quantization,
      contextWindow,
      isEmbed,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
