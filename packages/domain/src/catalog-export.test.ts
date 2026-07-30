import { describe, expect, it } from "vitest";
import {
  assertExportHasNoSecrets,
  sanitizeConnectionForExport,
} from "./catalog-export.js";

describe("sanitizeConnectionForExport", () => {
  it("strips ciphertext and apiKey", () => {
    const safe = sanitizeConnectionForExport({
      id: "conn_1",
      kind: "ollama",
      name: "Local",
      baseUrl: "http://127.0.0.1:11434",
      isEnabled: true,
      credentialsEncrypted: "ciphertext-blob-here",
      apiKey: "sk-secret",
      credentialsMeta: { hasSecret: false },
    });
    expect(safe.credentialsEncrypted).toBeUndefined();
    expect(safe.apiKey).toBeUndefined();
    expect(safe.hasCredentials).toBe(true);
    assertExportHasNoSecrets({ connections: [safe] });
  });

  it("assertExportHasNoSecrets throws on leaked apiKey", () => {
    expect(() =>
      assertExportHasNoSecrets({ apiKey: "sk-live-secret" }),
    ).toThrow(/apiKey/);
  });

  it("rejects long credentialsEncrypted ciphertext", () => {
    expect(() =>
      assertExportHasNoSecrets({
        credentialsEncrypted: "ciphertext-blob-abcdefgh",
      }),
    ).toThrow(/credentialsEncrypted/);
  });
});
