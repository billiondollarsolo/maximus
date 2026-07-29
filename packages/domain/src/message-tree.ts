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
