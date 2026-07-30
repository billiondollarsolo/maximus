import { describe, expect, it } from "vitest";
import {
  listActiveBranch,
  listSiblings,
  pathToRoot,
  planEditFork,
  planRegenerate,
  planSend,
  selectSiblingBranch,
  siblingBranchMeta,
  tipOfSubtree,
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

  describe("tipOfSubtree", () => {
    it("walks to deepest latest child", () => {
      // a1 → u2 → a3
      expect(tipOfSubtree(tree, "a1")).toBe("a3");
      expect(tipOfSubtree(tree, "u2")).toBe("a3");
    });

    it("from u1 follows max-position child a2 (leaf)", () => {
      // children of u1: a1 (pos 0), a2 (pos 1) → pick a2; a2 has no children → a2
      expect(tipOfSubtree(tree, "u1")).toBe("a2");
    });

    it("returns leaf itself when already a leaf", () => {
      expect(tipOfSubtree(tree, "a2")).toBe("a2");
      expect(tipOfSubtree(tree, "a3")).toBe("a3");
    });

    it("returns nodeId when missing", () => {
      expect(tipOfSubtree(tree, "missing")).toBe("missing");
    });

    it("prefers max position at each level", () => {
      const branched: TreeMessage[] = [
        msg("u1", null, "user", 0),
        msg("a1", "u1", "assistant", 0),
        msg("a2", "u1", "assistant", 1),
        msg("u2a", "a1", "user", 0),
        msg("u2b", "a1", "user", 1),
        msg("a3", "u2b", "assistant", 0),
      ];
      // from a1: children u2a(0), u2b(1) → u2b → a3
      expect(tipOfSubtree(branched, "a1")).toBe("a3");
      // from u1: max child a2 is leaf
      expect(tipOfSubtree(branched, "u1")).toBe("a2");
    });
  });

  describe("selectSiblingBranch", () => {
    it("moves right to next sibling tip", () => {
      // siblings a1, a2 under u1; from a1, direction +1 → a2 (leaf tip)
      expect(selectSiblingBranch(tree, "a1", 1)).toBe("a2");
    });

    it("moves left to previous sibling tip", () => {
      // from a2, direction -1 → a1 → tip a3
      expect(selectSiblingBranch(tree, "a2", -1)).toBe("a3");
    });

    it("returns null when out of range", () => {
      expect(selectSiblingBranch(tree, "a1", -1)).toBeNull();
      expect(selectSiblingBranch(tree, "a2", 1)).toBeNull();
    });

    it("returns null when alone (no siblings)", () => {
      expect(selectSiblingBranch(tree, "u1", 1)).toBeNull();
      expect(selectSiblingBranch(tree, "a3", -1)).toBeNull();
    });

    it("returns null for missing message", () => {
      expect(selectSiblingBranch(tree, "missing", 1)).toBeNull();
    });
  });

  describe("siblingBranchMeta", () => {
    it("returns 1-based index for 1-of-2 and 2-of-2", () => {
      expect(siblingBranchMeta(tree, "a1")).toEqual({ index: 1, total: 2 });
      expect(siblingBranchMeta(tree, "a2")).toEqual({ index: 2, total: 2 });
    });

    it("returns null when alone", () => {
      expect(siblingBranchMeta(tree, "u1")).toBeNull();
      expect(siblingBranchMeta(tree, "u2")).toBeNull();
      expect(siblingBranchMeta(tree, "a3")).toBeNull();
    });

    it("returns null for missing message", () => {
      expect(siblingBranchMeta(tree, "missing")).toBeNull();
    });
  });
});
