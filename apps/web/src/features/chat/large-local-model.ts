import { modelIdFromRef, parseModelRef } from "@maximus/domain";

/**
 * Parameter-size heuristic for local Ollama models that often incur long TTFT
 * (weights load into VRAM). Threshold: ≥ 13B.
 *
 * Matches ids like `gemma4:31b`, `llama3.1:70b`, `qwen2.5:14b`.
 */
export function parameterSizeBillionsFromModelId(modelId: string): number | null {
  const id = modelId.toLowerCase();
  // Prefer explicit size tags: :31b, -70b, 13b at end of segment
  const m = id.match(/(?:^|[:\-_./])(\d+(?:\.\d+)?)b(?:$|[:\-_./])/i);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * True when this picker entry is a large local (Ollama) model likely to stall
 * on first token while loading into memory.
 */
export function isLargeLocalModel(modelRef: string): boolean {
  if (!modelRef) return false;
  try {
    const ref = parseModelRef(modelRef);
    if (ref.providerKind !== "ollama") return false;
    const size = parameterSizeBillionsFromModelId(ref.modelId);
    return size != null && size >= 13;
  } catch {
    // Fallback: bare id without full ref shape
    if (!modelRef.includes("ollama")) return false;
    const size = parameterSizeBillionsFromModelId(modelIdFromRef(modelRef));
    return size != null && size >= 13;
  }
}

export const LARGE_LOCAL_MODEL_WARNING =
  "Large local model — first token may take 1–2 minutes while weights load into memory.";
