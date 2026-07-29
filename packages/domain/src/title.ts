export type TitleSource = "heuristic" | "llm" | "user";

const MAX_LEN = 60;

/**
 * Derive a sidebar title from the first user message text.
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
