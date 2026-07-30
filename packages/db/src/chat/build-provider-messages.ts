import {
  listActiveBranch,
  type ContentPart,
  type TreeMessage,
} from "@maximus/domain";

/** Minimal message shape needed to rebuild provider history. */
export type HistoryMsg = {
  id: string;
  parentMessageId: string | null;
  role: string;
  position: number;
  content: unknown;
};

export function toTree(allMsgs: HistoryMsg[]): TreeMessage[] {
  return allMsgs.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as TreeMessage["role"],
    position: m.position,
  }));
}

function contentPartsToProviderText(parts: ContentPart[]): string {
  const bits: string[] = [];
  for (const p of parts) {
    if (p.type === "text") bits.push(p.text);
    else if (p.type === "image")
      bits.push(`[image attachment:${p.attachmentId} mime:${p.mime}]`);
    else bits.push(`[file ${p.filename} attachment:${p.attachmentId}]`);
  }
  return bits.join("\n");
}

/**
 * Linearize active branch up to and including leafId (usually the latest user msg).
 * Provider messages include multimodal as text notes for non-vision fallbacks.
 */
export function buildProviderMessages(
  allMsgs: HistoryMsg[],
  leafId: string,
): Array<{ role: string; content: string }> {
  const tree = toTree(allMsgs);
  const branch = listActiveBranch(tree, leafId);
  return branch.map((m) => {
    const full = allMsgs.find((x) => x.id === m.id)!;
    const parts = (full.content as ContentPart[]) ?? [];
    const text = contentPartsToProviderText(parts);
    return { role: m.role, content: text };
  });
}
