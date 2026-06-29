/**
 * @repo/core — pure, framework-agnostic domain logic ONLY (no Prisma, no tRPC,
 * no React). Feature rules (grade calc, attendance %, promotion) land here in
 * later milestones. M0 ships only the domain-error primitive. ADR-002/003.
 */

/**
 * Base class for domain rule violations. The API layer maps these to tRPC
 * errors (API_CONVENTIONS.md §6). Carries a stable, machine-readable `code`.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DomainError";
  }
}
