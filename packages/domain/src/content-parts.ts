export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; attachmentId: string; mime: string }
  | { type: "file"; attachmentId: string; mime: string; filename: string };

export function textFromParts(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function normalizeContentParts(input: unknown): ContentPart[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("content must be a non-empty array");
  }
  const out: ContentPart[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") throw new Error("invalid content part");
    const p = raw as Record<string, unknown>;
    if (p.type === "text" && typeof p.text === "string") {
      out.push({ type: "text", text: p.text });
      continue;
    }
    if (
      p.type === "image" &&
      typeof p.attachmentId === "string" &&
      typeof p.mime === "string"
    ) {
      out.push({
        type: "image",
        attachmentId: p.attachmentId,
        mime: p.mime,
      });
      continue;
    }
    if (
      p.type === "file" &&
      typeof p.attachmentId === "string" &&
      typeof p.mime === "string" &&
      typeof p.filename === "string"
    ) {
      out.push({
        type: "file",
        attachmentId: p.attachmentId,
        mime: p.mime,
        filename: p.filename,
      });
      continue;
    }
    throw new Error("invalid content part");
  }
  return out;
}

export function textParts(text: string): ContentPart[] {
  return [{ type: "text", text }];
}
