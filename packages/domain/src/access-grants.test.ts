import { describe, expect, it } from "vitest";
import {
  accessModeFromLegacyAllowlist,
  grantsFromLegacyAllowlist,
  isResourceAllowed,
  parseAccessMode,
  type AccessGrant,
} from "./access-grants.js";

const baseGrants: AccessGrant[] = [
  {
    resourceType: "model",
    resourceRef: "ollama:c1:gemma3:4b",
    subjectType: "team",
    subjectId: "team_eng",
  },
  {
    resourceType: "model",
    resourceRef: "openai:platform:gpt-4.1",
    subjectType: "role",
    subjectId: "admin",
  },
  {
    resourceType: "model",
    resourceRef: "openai:platform:gpt-4.1-mini",
    subjectType: "org",
    subjectId: null,
  },
  {
    resourceType: "model",
    resourceRef: "ollama:c1:private",
    subjectType: "user",
    subjectId: "user_alice",
  },
];

describe("parseAccessMode", () => {
  it("defaults to open", () => {
    expect(parseAccessMode(undefined)).toBe("open");
    expect(parseAccessMode("open")).toBe("open");
    expect(parseAccessMode("allowlist")).toBe("allowlist");
  });
});

describe("isResourceAllowed", () => {
  it("open mode ignores grants", () => {
    expect(
      isResourceAllowed({
        accessMode: "open",
        grants: baseGrants,
        orgRole: "member",
        userId: "user_bob",
        teamIds: [],
        resourceType: "model",
        resourceRef: "anything:x:y",
      }),
    ).toBe(true);
  });

  it("allowlist: org subject allows everyone", () => {
    expect(
      isResourceAllowed({
        accessMode: "allowlist",
        grants: baseGrants,
        orgRole: "member",
        userId: "user_bob",
        teamIds: [],
        resourceType: "model",
        resourceRef: "openai:platform:gpt-4.1-mini",
      }),
    ).toBe(true);
  });

  it("allowlist: role subject", () => {
    const args = {
      accessMode: "allowlist" as const,
      grants: baseGrants,
      userId: "user_bob",
      teamIds: [] as string[],
      resourceType: "model" as const,
      resourceRef: "openai:platform:gpt-4.1",
    };
    expect(isResourceAllowed({ ...args, orgRole: "admin" })).toBe(true);
    expect(isResourceAllowed({ ...args, orgRole: "member" })).toBe(false);
  });

  it("allowlist: multi-team union", () => {
    const args = {
      accessMode: "allowlist" as const,
      grants: baseGrants,
      orgRole: "member" as const,
      userId: "user_bob",
      resourceType: "model" as const,
      resourceRef: "ollama:c1:gemma3:4b",
    };
    expect(isResourceAllowed({ ...args, teamIds: ["team_sales"] })).toBe(false);
    expect(
      isResourceAllowed({ ...args, teamIds: ["team_sales", "team_eng"] }),
    ).toBe(true);
  });

  it("allowlist: user subject", () => {
    const args = {
      accessMode: "allowlist" as const,
      grants: baseGrants,
      orgRole: "member" as const,
      teamIds: [] as string[],
      resourceType: "model" as const,
      resourceRef: "ollama:c1:private",
    };
    expect(isResourceAllowed({ ...args, userId: "user_alice" })).toBe(true);
    expect(isResourceAllowed({ ...args, userId: "user_bob" })).toBe(false);
  });

  it("allowlist: no matching grant denies", () => {
    expect(
      isResourceAllowed({
        accessMode: "allowlist",
        grants: baseGrants,
        orgRole: "member",
        userId: "user_bob",
        teamIds: [],
        resourceType: "model",
        resourceRef: "unknown:x:y",
      }),
    ).toBe(false);
  });
});

describe("legacy allowlist bridge", () => {
  it("empty → open", () => {
    expect(accessModeFromLegacyAllowlist([])).toBe("open");
  });

  it("rows → allowlist grants", () => {
    expect(accessModeFromLegacyAllowlist([{ modelRef: "a", role: null }])).toBe(
      "allowlist",
    );
    const g = grantsFromLegacyAllowlist([
      { modelRef: "ollama:c1:x", role: null },
      { modelRef: "openai:platform:y", role: "admin" },
    ]);
    expect(g).toEqual([
      {
        resourceType: "model",
        resourceRef: "ollama:c1:x",
        subjectType: "org",
        subjectId: null,
        effect: "allow",
      },
      {
        resourceType: "model",
        resourceRef: "openai:platform:y",
        subjectType: "role",
        subjectId: "admin",
        effect: "allow",
      },
    ]);
  });
});
