import { describe, expect, it } from "vitest";
import {
  agentIdFromModelRef,
  isAgentModelRef,
} from "./stream-assistant.js";

describe("agent model refs", () => {
  it("detects agent: preset ids", () => {
    expect(isAgentModelRef("agent:agent_abc")).toBe(true);
    expect(isAgentModelRef("ollama:c1:gemma3:4b")).toBe(false);
    expect(isAgentModelRef("agent:")).toBe(false);
  });

  it("extracts id after agent:", () => {
    expect(agentIdFromModelRef("agent:agent_abc")).toBe("agent_abc");
  });
});
