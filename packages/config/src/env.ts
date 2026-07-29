import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1).optional(),
  VALKEY_URL: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  PROVIDER_MODE: z.enum(["live", "fake"]).default("live"),
  RATE_LIMIT_FAIL_OPEN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof baseSchema>;

/**
 * Parse and validate process environment for Maximus.
 * Production requires DATABASE_URL.
 */
export function parseEnv(
  input: Record<string, string | undefined> = process.env,
): Env {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
    throw new Error("Invalid environment: DATABASE_URL is required in production");
  }

  return env;
}
