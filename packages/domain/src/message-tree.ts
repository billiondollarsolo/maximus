export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "aborted"
  | "error";

export type TreeMessage = {
  id: string;
  parentMessageId: string | null;
  role: MessageRole;
  position: number;
};

/** Path from root to leaf (inclusive), root first. */
export function pathToRoot(
  messages: TreeMessage[],
  leafId: string | null,
): TreeMessage[] {
  if (!leafId) return [];
  const byId = new Map(messages.map((m) => [m.id, m]));
  const path: TreeMessage[] = [];
  let cur: TreeMessage | undefined = byId.get(leafId);
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur.id)) throw new Error("cycle in message tree");
    seen.add(cur.id);
    path.push(cur);
    cur = cur.parentMessageId ? byId.get(cur.parentMessageId) : undefined;
  }
  return path.reverse();
}

/** Active branch as linear messages root→leaf. */
export function listActiveBranch(
  messages: TreeMessage[],
  activeLeafId: string | null,
): TreeMessage[] {
  return pathToRoot(messages, activeLeafId);
}

/** Siblings sharing the same parent, ordered by position. */
export function listSiblings(
  messages: TreeMessage[],
  messageId: string,
): TreeMessage[] {
  const target = messages.find((m) => m.id === messageId);
  if (!target) return [];
  return messages
    .filter((m) => m.parentMessageId === target.parentMessageId)
    .sort((a, b) => a.position - b.position);
}

/**
 * From nodeId, repeatedly follow the child with max `position` until a leaf.
 * Returns that leaf id. If node is missing, returns nodeId.
 */
export function tipOfSubtree(
  messages: TreeMessage[],
  nodeId: string,
): string {
  const byParent = new Map<string | null, TreeMessage[]>();
  for (const m of messages) {
    const list = byParent.get(m.parentMessageId) ?? [];
    list.push(m);
    byParent.set(m.parentMessageId, list);
  }
  if (!messages.some((m) => m.id === nodeId)) return nodeId;

  let cur = nodeId;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(cur)) throw new Error("cycle in message tree");
    seen.add(cur);
    const children = byParent.get(cur) ?? [];
    if (children.length === 0) return cur;
    let best = children[0]!;
    for (let i = 1; i < children.length; i++) {
      const c = children[i]!;
      if (c.position > best.position) best = c;
    }
    cur = best.id;
  }
}

/**
 * Move to the previous (-1) or next (+1) sibling branch tip.
 * Returns null if fewer than 2 siblings or the move is out of range.
 */
export function selectSiblingBranch(
  messages: TreeMessage[],
  currentMessageId: string,
  direction: -1 | 1,
): string | null {
  const siblings = listSiblings(messages, currentMessageId);
  if (siblings.length < 2) return null;
  const idx = siblings.findIndex((m) => m.id === currentMessageId);
  if (idx < 0) return null;
  const next = idx + direction;
  if (next < 0 || next >= siblings.length) return null;
  return tipOfSubtree(messages, siblings[next]!.id);
}

/**
 * 1-based index of messageId among siblings (by position) and total count.
 * Null when fewer than 2 siblings (no branch UI).
 */
export function siblingBranchMeta(
  messages: TreeMessage[],
  messageId: string,
): { index: number; total: number } | null {
  const siblings = listSiblings(messages, messageId);
  if (siblings.length < 2) return null;
  const idx = siblings.findIndex((m) => m.id === messageId);
  if (idx < 0) return null;
  return { index: idx + 1, total: siblings.length };
}

export type RegeneratePlan = {
  parentMessageId: string;
  position: number;
};

/** Plan a new assistant sibling under the same parent user message. */
export function planRegenerate(
  messages: TreeMessage[],
  assistantMessageId: string,
): RegeneratePlan {
  const assistant = messages.find((m) => m.id === assistantMessageId);
  if (!assistant || assistant.role !== "assistant") {
    throw new Error("regenerate requires an assistant message");
  }
  if (!assistant.parentMessageId) {
    throw new Error("assistant message missing parent");
  }
  const siblings = messages.filter(
    (m) => m.parentMessageId === assistant.parentMessageId,
  );
  const maxPos = siblings.reduce((n, m) => Math.max(n, m.position), -1);
  return {
    parentMessageId: assistant.parentMessageId,
    position: maxPos + 1,
  };
}

export type EditForkPlan = {
  parentMessageId: string | null;
  position: number;
};

/**
 * Plan a new user node for edit-fork: parent = grandparent of edited user msg
 * (or null if edited was root). Does not mutate history.
 */
export function planEditFork(
  messages: TreeMessage[],
  userMessageId: string,
): EditForkPlan {
  const user = messages.find((m) => m.id === userMessageId);
  if (!user || user.role !== "user") {
    throw new Error("edit requires a user message");
  }
  const parentMessageId = user.parentMessageId;
  const siblings = messages.filter((m) => m.parentMessageId === parentMessageId);
  const maxPos = siblings.reduce((n, m) => Math.max(n, m.position), -1);
  return { parentMessageId, position: maxPos + 1 };
}

export type SendPlan = {
  parentMessageId: string | null;
  position: number;
};

/** Plan appending a user message under the current leaf (or root). */
export function planSend(
  messages: TreeMessage[],
  activeLeafId: string | null,
): SendPlan {
  if (!activeLeafId) {
    const roots = messages.filter((m) => m.parentMessageId === null);
    const maxPos = roots.reduce((n, m) => Math.max(n, m.position), -1);
    return { parentMessageId: null, position: maxPos + 1 };
  }
  const siblings = messages.filter((m) => m.parentMessageId === activeLeafId);
  const maxPos = siblings.reduce((n, m) => Math.max(n, m.position), -1);
  return { parentMessageId: activeLeafId, position: maxPos + 1 };
}
