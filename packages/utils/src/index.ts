/**
 * @repo/utils — generic, domain-agnostic helpers. No business logic, no IO.
 */
import { APP_TIMEZONE } from "@repo/constants";

/** Exhaustiveness guard for discriminated unions / switch statements. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

/** Type guard narrowing out `null` and `undefined`. */
export function isDefined<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

/**
 * Format a `Date` as an IST (Asia/Kolkata) calendar date `YYYY-MM-DD`.
 * Calendar-date fields are keyed on the IST date to avoid a UTC off-by-one
 * (Dev PRD §2; DATABASE_CONVENTIONS.md §4).
 */
export function toIstDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
