/**
 * Parse conversation id from a pathname.
 * Prefer this over router match tables — matches can be empty mid-transition
 * while the address bar still shows `/c/{id}`.
 */
export function conversationIdFromPath(pathname: string): string | null {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  const m = path.match(/^\/c\/([^/]+)\/?$/);
  const id = m?.[1]?.trim();
  return id && id.length > 0 ? id : null;
}
