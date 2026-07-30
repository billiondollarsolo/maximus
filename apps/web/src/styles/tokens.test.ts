import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(dir, "tokens.css"), "utf8");

describe("design tokens", () => {
  it("defines dark canvas and sidebar near ChatGPT product greys", () => {
    expect(tokens).toMatch(/--bg-app:\s*#212121/);
    expect(tokens).toMatch(/--bg-sidebar:\s*#171717/);
    expect(tokens).toMatch(/--bg-composer:\s*#2f2f2f/);
  });

  it("has light theme overrides", () => {
    expect(tokens).toMatch(/\[data-theme="light"\]/);
    expect(tokens).toMatch(/--bg-app:\s*#ffffff/);
  });

  it("uses neutral primary button tokens (not green send)", () => {
    expect(tokens).toMatch(/--btn-primary:/);
    expect(tokens).toMatch(/--btn-primary-fg:/);
  });
});
