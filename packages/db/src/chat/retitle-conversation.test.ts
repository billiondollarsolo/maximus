import { describe, expect, it } from "vitest";
import {
  fakeGeneratedTitle,
  normalizeGeneratedTitle,
  shouldRunAutoRetitle,
} from "@maximus/domain";

/**
 * Unit-level contracts for retitle policy. Integration of retitleConversation
 * runs inside runChatTurn (fake provider) when DATABASE_URL is available.
 */
describe("retitle policy", () => {
  it("only auto-retitles heuristic titles", () => {
    expect(shouldRunAutoRetitle("heuristic")).toBe(true);
    expect(shouldRunAutoRetitle("user")).toBe(false);
    expect(shouldRunAutoRetitle("llm")).toBe(false);
  });

  it("fake title is not the full first-message dump for long questions", () => {
    const user =
      "how do I configure ollama with maximus for local development and testing?";
    const heuristic = user; // would be full string under 60? it's longer
    const fake = fakeGeneratedTitle(user);
    expect(fake.length).toBeLessThanOrEqual(60);
    expect(fake.toLowerCase()).not.toMatch(/^how do i/);
    expect(normalizeGeneratedTitle(`"${fake}"`)).toBe(fake);
    void heuristic;
  });
});
