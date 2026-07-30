import { describe, expect, it } from "vitest";
import { composeCatalog } from "./compose-catalog.js";
import type { CatalogModel } from "./models-for-user.js";

const platform: CatalogModel[] = [
  {
    modelRef: "openai:platform:gpt-4.1",
    displayName: "GPT-4.1",
    providerKind: "openai",
    isEnabled: true,
  },
  {
    modelRef: "anthropic:platform:claude-sonnet-4",
    displayName: "Claude Sonnet 4",
    providerKind: "anthropic",
    isEnabled: true,
  },
];

describe("composeCatalog", () => {
  it("keeps platform models when org has a BYOK model", () => {
    const org: CatalogModel[] = [
      {
        modelRef: "openai:conn_1:gpt-4.1",
        displayName: "GPT-4.1 (BYOK)",
        providerKind: "openai",
        isEnabled: true,
      },
    ];
    const out = composeCatalog({ platform, orgModels: org });
    expect(out.map((m) => m.modelRef)).toEqual(
      expect.arrayContaining([
        "openai:platform:gpt-4.1",
        "anthropic:platform:claude-sonnet-4",
        "openai:conn_1:gpt-4.1",
      ]),
    );
    expect(out).toHaveLength(3);
  });

  it("org override same modelRef replaces platform entry", () => {
    const org: CatalogModel[] = [
      {
        modelRef: "openai:platform:gpt-4.1",
        displayName: "GPT-4.1 (hidden)",
        providerKind: "openai",
        isEnabled: false,
      },
    ];
    const out = composeCatalog({ platform, orgModels: org });
    const gpt = out.find((m) => m.modelRef === "openai:platform:gpt-4.1");
    expect(gpt?.isEnabled).toBe(false);
    expect(gpt?.displayName).toBe("GPT-4.1 (hidden)");
    expect(out.filter((m) => m.modelRef === "openai:platform:gpt-4.1")).toHaveLength(
      1,
    );
  });

  it("empty org returns platform only", () => {
    const out = composeCatalog({ platform, orgModels: [] });
    expect(out).toHaveLength(2);
  });
});
