export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "MODEL_UNAVAILABLE",
  "VALIDATION",
  "PROVIDER_ERROR",
  "ABORTED",
  "BUDGET_EXCEEDED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status =
      status ??
      ({
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        RATE_LIMITED: 429,
        MODEL_UNAVAILABLE: 400,
        VALIDATION: 400,
        PROVIDER_ERROR: 502,
        ABORTED: 499,
        BUDGET_EXCEEDED: 402,
      }[code] as number);
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
