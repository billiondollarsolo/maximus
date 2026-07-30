import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(dir, "tokens.css"), "utf8");

describe("design tokens", () => {
  it("uses near-black ChatGPT canvas", () => {
    expect(tokens).toMatch(/--bg-app:\s*#000000/);
    expect(tokens).toMatch(/--bg-sidebar:\s*#0a0a0a/);
  });

  it("has light theme overrides", () => {
    expect(tokens).toMatch(/\[data-theme="light"\]/);
    expect(tokens).toMatch(/--bg-app:\s*#ffffff/);
  });

  it("uses neutral primary button tokens", () => {
    expect(tokens).toMatch(/--btn-primary:/);
    expect(tokens).toMatch(/--btn-primary-fg:/);
  });
});
