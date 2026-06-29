import type { RoleKey } from "@repo/constants";

import type { AuthUser } from "./context";

/**
 * Coarse role check (Dev PRD §5). Fine-grained scope (own division, linked
 * students, etc.) is enforced in the business layer, not here (ADR-002, §4.4).
 */
export function hasRole(user: Pick<AuthUser, "role">, allowed: readonly RoleKey[]): boolean {
  return user.role !== undefined && allowed.includes(user.role);
}
