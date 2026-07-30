/**
 * While tokens stream, model output often has an unclosed ``` fence.
 * Close it so the markdown parser can render a stable code block mid-stream.
 */
export function prepareStreamingMarkdown(source: string): string {
  if (!source) return source;
  let open = false;
  for (const line of source.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      open = !open;
    }
  }
  return open ? `${source}\n\`\`\`` : source;
}

/** Plain text from highlighted code React trees (for clipboard). */
export function textFromReactChildren(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map(textFromReactChildren).join("");
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return textFromReactChildren(props?.children);
  }
  return "";
}
