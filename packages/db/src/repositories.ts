/**
 * Repository barrel (ADR-003).
 *
 * This is a COMPILE-TIME barrel export ONLY — it re-exports repository modules
 * and the aggregate type. It is explicitly **not** a runtime service locator:
 *   - no global/ambient registry object,
 *   - no string-keyed `get(name)` lookup,
 *   - no singleton that code reaches into.
 *
 * Repositories are constructed at the composition root and injected into
 * services explicitly via `ServiceContext` (dependency injection, not lookup).
 * Feature repositories are re-exported here per milestone; none exist in M0.
 */

// export * from "./student.repository";   // M1
// export * from "./attendance.repository"; // M2

/** Aggregate of repositories injected into services via `ServiceContext`. Empty in M0. */
export interface Repositories {
  readonly _empty?: never;
}
