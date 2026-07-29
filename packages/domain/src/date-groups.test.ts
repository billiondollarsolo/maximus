import { describe, expect, it } from "vitest";
import { groupByDateGroups } from "./date-groups.js";

describe("groupByDateGroups", () => {
  const now = new Date("2026-07-29T15:00:00Z");

  it("buckets today, yesterday, week, and older", () => {
    const groups = groupByDateGroups(
      [
        { id: "1", updatedAt: "2026-07-29T12:00:00Z" },
        { id: "2", updatedAt: "2026-07-28T12:00:00Z" },
        { id: "3", updatedAt: "2026-07-25T12:00:00Z" },
        { id: "4", updatedAt: "2026-07-01T12:00:00Z" },
      ],
      now,
    );

    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Older",
    ]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["1"]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(["2"]);
    expect(groups[2]?.items.map((i) => i.id)).toEqual(["3"]);
    expect(groups[3]?.items.map((i) => i.id)).toEqual(["4"]);
  });

  it("omits empty buckets", () => {
    const groups = groupByDateGroups(
      [{ id: "1", updatedAt: "2026-07-29T12:00:00Z" }],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Today");
  });
});
