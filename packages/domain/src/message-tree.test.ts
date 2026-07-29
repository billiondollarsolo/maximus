import { describe, expect, it } from "vitest";
import {
  listActiveBranch,
  listSiblings,
  pathToRoot,
  planEditFork,
  planRegenerate,
  planSend,
  type TreeMessage,
} from "./message-tree.js";

function msg(
  id: string,
  parentMessageId: string | null,
  role: TreeMessage["role"],
  position = 0,
): TreeMessage {
  return { id, parentMessageId, role, position };
}

describe("message-tree", () => {
  const tree: TreeMessage[] = [
    msg("u1", null, "user", 0),
    msg("a1", "u1", "assistant", 0),
    msg("a2", "u1", "assistant", 1),
    msg("u2", "a1", "user", 0),
    msg("a3", "u2", "assistant", 0),
  ];

  it("pathToRoot walks to root", () => {
    expect(pathToRoot(tree, "a3").map((m) => m.id)).toEqual([
      "u1",
      "a1",
      "u2",
      "a3",
    ]);
  });

  it("listActiveBranch matches path", () => {
    expect(listActiveBranch(tree, "a2").map((m) => m.id)).toEqual(["u1", "a2"]);
  });

  it("listSiblings orders by position", () => {
    expect(listSiblings(tree, "a1").map((m) => m.id)).toEqual(["a1", "a2"]);
  });

  it("planRegenerate creates sibling assistant under same parent", () => {
    const plan = planRegenerate(tree, "a1");
    expect(plan.parentMessageId).toBe("u1");
    expect(plan.position).toBe(2);
  });

  it("planEditFork does not mutate; parent is grandparent", () => {
    const plan = planEditFork(tree, "u2");
    expect(plan.parentMessageId).toBe("a1");
    expect(plan.position).toBe(1);
  });

  it("planSend under leaf appends child", () => {
    const plan = planSend(tree, "a3");
    expect(plan.parentMessageId).toBe("a3");
    expect(plan.position).toBe(0);
  });

  it("planSend on empty uses root", () => {
    expect(planSend([], null)).toEqual({ parentMessageId: null, position: 0 });
  });
});
