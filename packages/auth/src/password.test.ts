import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password", () => {
  it("hashes and verifies", () => {
    const h = hashPassword("secret-pass");
    expect(h).not.toContain("secret-pass");
    expect(verifyPassword("secret-pass", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});
