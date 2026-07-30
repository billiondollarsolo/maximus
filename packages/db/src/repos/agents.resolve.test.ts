import { describe, expect, it } from "vitest";
import { resolveAgentForRun } from "./agents.js";

describe("resolveAgentForRun", () => {
  it("succeeds when base enabled", () => {
    const r = resolveAgentForRun({
      agent: {
        name: "Support",
        baseModelRef: "ollama:c1:gemma3:4b",
        systemPrompt: "Be brief",
        params: { temperature: 0.2 },
        isEnabled: true,
      },
      baseOffering: { modelRef: "ollama:c1:gemma3:4b", isEnabled: true },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.systemPrompt).toBe("Be brief");
      expect(r.params.temperature).toBe(0.2);
    }
  });

  it("fails clearly when base disabled", () => {
    const r = resolveAgentForRun({
      agent: {
        name: "Support",
        baseModelRef: "ollama:c1:gemma3:4b",
        systemPrompt: null,
        params: {},
        isEnabled: true,
      },
      baseOffering: { modelRef: "ollama:c1:gemma3:4b", isEnabled: false },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/disabled/i);
  });

  it("fails when base missing", () => {
    const r = resolveAgentForRun({
      agent: {
        name: "Support",
        baseModelRef: "ollama:c1:missing",
        systemPrompt: null,
        params: {},
        isEnabled: true,
      },
      baseOffering: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not available/i);
  });
});
