import { describe, expect, it } from "vitest";
import {
  legacyAllowlistToAccess,
  modelsForUser,
  type CatalogModel,
} from "./models-for-user.js";
import {
  defaultPlatformCatalog,
  defaultPlatformModelRef,
} from "./platform-catalog.js";
import type { AccessGrant } from "./access-grants.js";

const base: CatalogModel[] = [
  {
    modelRef: "openai:platform:gpt-4.1",
    displayName: "GPT-4.1",
    providerKind: "openai",
    isEnabled: true,
    capabilities: { streaming: true },
  },
  {
    modelRef: "ollama:c1:off",
    displayName: "Off",
    providerKind: "ollama",
    isEnabled: false,
  },
  {
    modelRef: "ollama:c1:gemma3:4b",
    displayName: "gemma3:4b",
    providerKind: "ollama",
    isEnabled: true,
    isVisible: true,
  },
  {
    modelRef: "ollama:c1:hidden",
    displayName: "hidden",
    providerKind: "ollama",
    isEnabled: true,
    isVisible: false,
  },
  {
    modelRef: "ollama:c1:nomic-embed-text",
    displayName: "nomic-embed-text",
    providerKind: "ollama",
    isEnabled: true,
    capabilities: { embedding: true },
  },
];

describe("modelsForUser", () => {
  it("filters disabled, hidden, embeddings, allowlist (legacy)", () => {
    const out = modelsForUser(base, "member", []);
    const refs = out.map((m) => m.modelRef);
    expect(refs).toContain("openai:platform:gpt-4.1");
    expect(refs).toContain("ollama:c1:gemma3:4b");
    expect(refs).not.toContain("ollama:c1:off");
    expect(refs).not.toContain("ollama:c1:hidden");
    expect(refs).not.toContain("ollama:c1:nomic-embed-text");
  });

  it("legacy allowlist restricts via single grants path adapter", () => {
    const adapted = legacyAllowlistToAccess([
      { modelRef: "ollama:c1:gemma3:4b", role: null },
    ]);
    expect(adapted.accessMode).toBe("allowlist");
    expect(adapted.grants).toHaveLength(1);
    expect(adapted.grants[0]!.subjectType).toBe("org");

    const out = modelsForUser(base, "member", [
      { modelRef: "ollama:c1:gemma3:4b", role: null },
    ]);
    expect(out.map((m) => m.modelRef)).toEqual(["ollama:c1:gemma3:4b"]);
  });

  it("can include embeddings when requested", () => {
    const out = modelsForUser(base, "owner", [], { includeEmbeddings: true });
    expect(out.some((m) => m.modelRef.includes("nomic-embed"))).toBe(true);
  });

  it("open mode with grants still shows all enabled visible", () => {
    const grants: AccessGrant[] = [
      {
        resourceType: "model",
        resourceRef: "ollama:c1:gemma3:4b",
        subjectType: "team",
        subjectId: "t1",
      },
    ];
    const out = modelsForUser(base, "member", [], {
      accessMode: "open",
      grants,
      userId: "u1",
      teamIds: [],
    });
    expect(out.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "openai:platform:gpt-4.1",
        "ollama:c1:gemma3:4b",
      ]),
    );
  });

  it("allowlist mode filters by team grant", () => {
    const grants: AccessGrant[] = [
      {
        resourceType: "model",
        resourceRef: "ollama:c1:gemma3:4b",
        subjectType: "team",
        subjectId: "team_eng",
      },
    ];
    const denied = modelsForUser(base, "member", [], {
      accessMode: "allowlist",
      grants,
      userId: "u1",
      teamIds: ["team_sales"],
    });
    expect(denied.map((m) => m.modelRef)).toEqual([]);

    const allowed = modelsForUser(base, "member", [], {
      accessMode: "allowlist",
      grants,
      userId: "u1",
      teamIds: ["team_eng"],
    });
    expect(allowed.map((m) => m.modelRef)).toEqual(["ollama:c1:gemma3:4b"]);
  });

  it("agent uses baseModelRef for grant check", () => {
    const catalog: CatalogModel[] = [
      {
        modelRef: "agent:a1",
        displayName: "Support",
        providerKind: "agent",
        isEnabled: true,
        baseModelRef: "ollama:c1:gemma3:4b",
      },
    ];
    const grants: AccessGrant[] = [
      {
        resourceType: "model",
        resourceRef: "ollama:c1:gemma3:4b",
        subjectType: "org",
        subjectId: null,
      },
    ];
    const ok = modelsForUser(catalog, "member", [], {
      accessMode: "allowlist",
      grants,
      userId: "u1",
      teamIds: [],
    });
    expect(ok).toHaveLength(1);

    const no = modelsForUser(catalog, "member", [], {
      accessMode: "allowlist",
      grants: [],
      userId: "u1",
      teamIds: [],
    });
    expect(no).toHaveLength(0);
  });
});

describe("defaultPlatformModelRef", () => {
  it("returns first enabled catalog model when keys present", () => {
    const env = { providerMode: "live" as const, openai: true };
    const ref = defaultPlatformModelRef(env);
    const cat = defaultPlatformCatalog(env);
    expect(ref).toBe(cat.find((m) => m.isEnabled)!.modelRef);
  });

  it("stable placeholder when catalog empty", () => {
    expect(defaultPlatformModelRef({ providerMode: "live" })).toBe(
      "openai:platform:gpt-4.1",
    );
  });
});
