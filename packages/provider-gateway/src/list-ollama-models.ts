import { assertSafeBaseUrl } from "./ssrf.js";
import { isEmbeddingModelName } from "@maximus/domain";

export type ListOllamaModelsInput = {
  baseUrl: string;
  allowPrivateBaseUrls?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type OllamaModelTag = {
  /** Full tag name from Ollama, e.g. `llama3.2:latest` */
  name: string;
  isEmbed: boolean;
  parameterSize?: string;
  family?: string;
};

/**
 * List models installed on an Ollama instance (`GET /api/tags`).
 * Returns [] on network/parse failure (catalog should not hard-fail).
 */
export async function listOllamaModels(
  input: ListOllamaModelsInput,
): Promise<OllamaModelTag[]> {
  const fetchFn = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 4_000;
  const raw = input.baseUrl.trim().replace(/\/+$/, "");
  if (!raw) return [];

  try {
    assertSafeBaseUrl(raw, {
      allowPrivate: input.allowPrivateBaseUrls ?? false,
    });
  } catch {
    return [];
  }

  const url = `${raw}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      models?: Array<{
        name?: string;
        model?: string;
        details?: { family?: string; parameter_size?: string };
      }>;
    };
    const models = Array.isArray(body.models) ? body.models : [];
    const out: OllamaModelTag[] = [];
    const seen = new Set<string>();
    for (const m of models) {
      const name = (m.name ?? m.model ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        isEmbed: isEmbeddingModelName(name),
        parameterSize: m.details?.parameter_size,
        family: m.details?.family,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
