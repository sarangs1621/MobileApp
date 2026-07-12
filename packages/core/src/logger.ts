/**
 * Centralized structured logger (ADR-025 §3). One-line JSON to stdout/stderr —
 * the sink a log collector (Docker/Vercel/Supabase) scrapes. Lives in `@repo/core`
 * so both `business` (notification-failure sites) and `api` (transport middleware)
 * can use it without a dependency-boundary violation.
 *
 * Levels: info / warn / error. Fields the transport populates: requestId, userId,
 * schoolId, route, durationMs, status, error, stack (ADR-025 §3). `console.*` here
 * is the intended sink, not ad-hoc logging — do not "replace" it.
 *
 * ponytail: hand-rolled JSON, no dependency. Swap for pino only if we need
 * sampling/redaction/transports the one-liner can't do.
 */
export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  // `| undefined` (exactOptionalPropertyTypes): the transport passes optional
  // context like `ctx.user?.userId`, which is `string | undefined`.
  requestId?: string | undefined;
  userId?: string | undefined;
  schoolId?: string | undefined;
  route?: string | undefined;
  durationMs?: number | undefined;
  status?: string | undefined;
  error?: string | undefined;
  stack?: string | undefined;
  [key: string]: unknown;
}

/** Serialize an unknown thrown value into `{ error, stack }` for structured logs. */
export function errorFields(err: unknown): Pick<LogFields, "error" | "stack"> {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  // The single sanctioned console sink (see file header).
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console -- info sink; warn/error are already allowed
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
