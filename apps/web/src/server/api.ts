import { AppError, isAppError } from "@maximus/domain";
import { assertSameOrigin, withSecurityHeaders } from "./security";
import { serverEnv } from "./env";

export function jsonError(err: unknown): Response {
  if (isAppError(err) || err instanceof AppError) {
    return withSecurityHeaders(
      Response.json(
        { error: err.message, code: err.code },
        { status: err.status },
      ),
    );
  }
  return withSecurityHeaders(
    Response.json({ error: "Internal error" }, { status: 500 }),
  );
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return withSecurityHeaders(Response.json(data, init));
}

/** Guard mutating API requests (same-origin), respecting TRUST_PROXY. */
export function guardMutation(request: Request): void {
  const env = serverEnv();
  assertSameOrigin(request, env.appUrl);
}
