import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function keyFromEnv(encryptionKey: string): Buffer {
  const buf = Buffer.from(encryptionKey, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes base64");
  }
  return buf;
}

/** Encrypt secret with AES-256-GCM; returns base64(iv|tag|ciphertext). */
export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = keyFromEnv(encryptionKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt secret produced by encryptSecret. */
export function decryptSecret(payload: string, encryptionKey: string): string {
  const key = keyFromEnv(encryptionKey);
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** Generate a valid ENCRYPTION_KEY for tests/bootstrap. */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}
