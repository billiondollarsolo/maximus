/**
 * Strip secrets from provider connection records for export.
 */
export function sanitizeConnectionForExport(conn: {
  id: string;
  kind: string;
  name: string;
  baseUrl?: string | null;
  isEnabled: boolean;
  credentialsEncrypted?: string;
  credentialsMeta?: Record<string, unknown> | null;
  apiKey?: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const {
    credentialsEncrypted: _c,
    apiKey: _a,
    credentialsMeta,
    ...rest
  } = conn;
  const meta = { ...(credentialsMeta ?? {}) };
  delete meta.secret;
  delete meta.apiKey;
  delete meta.key;
  // Prefer actual ciphertext presence; meta.hasSecret is only a hint when no blob was passed.
  const hasCredentials = Boolean(
    conn.credentialsEncrypted || meta.hasSecret === true,
  );
  return {
    ...rest,
    hasCredentials,
    credentialsMeta: { hasSecret: hasCredentials },
  };
}

export function assertExportHasNoSecrets(payload: unknown): void {
  const s = JSON.stringify(payload);
  if (/"credentialsEncrypted"\s*:/.test(s) && !/"hasCredentials"/.test(s)) {
    // still allow the word in comments? hard fail if ciphertext-looking
  }
  if (/"apiKey"\s*:\s*"[^"]+"/.test(s)) {
    throw new Error("export leaked apiKey");
  }
  if (/"credentialsEncrypted"\s*:\s*"[^"]{8,}"/.test(s)) {
    throw new Error("export leaked credentialsEncrypted");
  }
}
