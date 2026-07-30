export function serverEnv() {
  return {
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgres://maximus:maximus@localhost:5432/maximus",
    valkeyUrl: process.env.VALKEY_URL ?? "redis://localhost:6379",
    encryptionKey: process.env.ENCRYPTION_KEY,
    providerMode: (process.env.PROVIDER_MODE === "live" ? "live" : "fake") as
      | "live"
      | "fake",
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    allowPrivateBaseUrls: process.env.ALLOW_PRIVATE_BASE_URLS !== "false",
    rateLimitFailOpen: process.env.RATE_LIMIT_FAIL_OPEN === "true",
    userPerMin: Number(process.env.RATE_LIMIT_USER_PER_MIN ?? 60),
    orgPerMin: Number(process.env.RATE_LIMIT_ORG_PER_MIN ?? 600),
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      accessKey: process.env.S3_ACCESS_KEY ?? "maximus",
      secretKey: process.env.S3_SECRET_KEY ?? "maximussecret",
      bucket: process.env.S3_BUCKET ?? "maximus-uploads",
    },
  };
}
