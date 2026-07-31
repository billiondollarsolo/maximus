import { describe, expect, it } from "vitest";
import { conversationIdFromPath } from "./conversation-id";

describe("conversationIdFromPath", () => {
  it("parses /c/{id}", () => {
    expect(conversationIdFromPath("/c/conv_abc")).toBe("conv_abc");
    expect(conversationIdFromPath("/c/conv_abc/")).toBe("conv_abc");
  });

  it("ignores query/hash", () => {
    expect(conversationIdFromPath("/c/conv_abc?x=1")).toBe("conv_abc");
    expect(conversationIdFromPath("/c/conv_abc#y")).toBe("conv_abc");
  });

  it("returns null for home and other routes", () => {
    expect(conversationIdFromPath("/")).toBeNull();
    expect(conversationIdFromPath("/projects")).toBeNull();
    expect(conversationIdFromPath("/c/")).toBeNull();
  });
});
