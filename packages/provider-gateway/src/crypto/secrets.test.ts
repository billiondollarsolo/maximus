import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateEncryptionKey,
} from "./secrets.js";

describe("encryptSecret/decryptSecret", () => {
  it("roundtrips", () => {
    const key = generateEncryptionKey();
    const ct = encryptSecret("sk-test-secret", key);
    expect(ct).not.toContain("sk-test");
    expect(decryptSecret(ct, key)).toBe("sk-test-secret");
  });

  it("fails on tamper", () => {
    const key = generateEncryptionKey();
    const ct = encryptSecret("hello", key);
    const buf = Buffer.from(ct, "base64");
    const last = buf.length - 1;
    buf[last] = (buf[last] ?? 0) ^ 0xff;
    expect(() => decryptSecret(buf.toString("base64"), key)).toThrow();
  });

  it("rejects bad key length", () => {
    expect(() => encryptSecret("x", Buffer.from("short").toString("base64"))).toThrow(
      /32 bytes/,
    );
  });
});
