/**
 * @repo/constants — cross-cutting config constants only (no logic, no business data).
 * Configurable domain data (e.g. grade bands) lives in the DB, never here. ADR-006.
 */

/** Supported deployment environments (Dev PRD §11). */
export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Supported UI locales — English + Malayalam (Dev PRD §2). */
export const LOCALES = ["en", "ml"] as const;
export type LocaleCode = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = "en";

/** User roles (Dev PRD §5). Mirrored as a Prisma enum in M1; no STUDENT (students are records). */
export const ROLES = ["SUPER_ADMIN", "OFFICE_ADMIN", "TEACHER", "PARENT", "ACCOUNTANT"] as const;
export type RoleKey = (typeof ROLES)[number];

/** Notification channels (ADR-005). Mirrored as a Prisma enum in M1. */
export const NOTIFICATION_CHANNELS = ["IN_APP", "PUSH", "SMS", "WHATSAPP"] as const;
export type NotificationChannelKey = (typeof NOTIFICATION_CHANNELS)[number];

/** Add-on feature-flag keys (ADR-006). Core capabilities are always on, never flagged. */
export const FEATURE_FLAGS = {
  FEES: "fees",
  WHATSAPP: "whatsapp",
  TIMETABLE: "timetable",
  ANALYTICS: "analytics",
  OFFLINE: "offline",
} as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Pagination defaults (API_CONVENTIONS.md §8). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Canonical timezone — store UTC, render IST (Dev PRD §2). */
export const APP_TIMEZONE = "Asia/Kolkata";
