export type TitleSource = "heuristic" | "llm" | "user";

const MAX_LEN = 60;

/**
 * Derive a sidebar title from the first user message text.
 * Used immediately on conversation create; LLM retitle may replace later.
 */
export function heuristicTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) return "New chat";
  if (collapsed.length <= MAX_LEN) return collapsed;

  const slice = collapsed.slice(0, MAX_LEN);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return `${base}…`;
}

/**
 * Whether an automatic retitle is allowed for the current title source.
 * User renames must never be overwritten.
 */
export function shouldRetitle(source: TitleSource | null | undefined): boolean {
  return source !== "user";
}

/**
 * First-exchange auto-retitle only (heuristic / unset). Already-LLM titles
 * and user renames are left alone.
 */
export function shouldRunAutoRetitle(
  source: TitleSource | null | undefined,
): boolean {
  return source == null || source === "heuristic";
}

/** System prompt for the short retitle completion. */
export const RETITLE_SYSTEM_PROMPT =
  "You name chat threads for a sidebar. Reply with a short title only (3–8 words). " +
  "Capture the topic, not a greeting. Never reply with just hi/hello/hey. " +
  "No quotes, no trailing punctuation, no prefixes like Title:.";

export function buildRetitleUserPrompt(
  userText: string,
  assistantText: string,
): string {
  const u = clip(userText, 500);
  const a = clip(assistantText, 500);
  return `User:\n${u || "(empty)"}\n\nAssistant:\n${a || "(empty)"}\n\nTitle:`;
}

/**
 * Clean model output into a sidebar title. Returns null if unusable
 * (empty, too short, or model refused with a sentence).
 */
export function normalizeGeneratedTitle(raw: string): string | null {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;

  // Strip common wrappers / prefixes models emit
  t = t.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
  t = t.replace(/^(title|chat title|thread title)\s*:\s*/i, "").trim();
  t = t.replace(/[.!?…]+$/g, "").trim();

  if (t.length < 2) return null;
  // Reject long multi-sentence dumps
  const sentenceBits = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (t.length > 120 || sentenceBits.length >= 2) return null;

  if (t.length <= MAX_LEN) return t;

  const slice = t.slice(0, MAX_LEN);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return `${base}…`;
}

/**
 * Deterministic stand-in used when PROVIDER_MODE=fake (tests/dev without keys).
 * Produces a short phrase distinct from the raw first-message heuristic.
 */
export function fakeGeneratedTitle(userText: string): string {
  let t = userText.replace(/\s+/g, " ").trim();
  t = t.replace(
    /^(hey|hi|hello|please|can you|could you|would you|i need|i want|help me)\s+/i,
    "",
  );
  t = t.replace(
    /^(how do i|how to|what is|what's|whats|why is|why are|explain)\s+/i,
    "",
  );
  t = t.replace(/[?!.]+$/g, "").trim();
  if (!t) return "New chat";

  const words = t.split(" ").filter(Boolean).slice(0, 6);
  const titled = words
    .map((w) => {
      if (w.length <= 2 && w === w.toLowerCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
  return heuristicTitle(titled);
}

function clip(text: string, max: number): string {
  const c = text.replace(/\s+/g, " ").trim();
  if (c.length <= max) return c;
  return `${c.slice(0, max)}…`;
}
