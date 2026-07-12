import type { AuthUser } from "@repo/auth";
import { resolvePrincipal, type Principal, type StoragePort } from "@repo/business";

/**
 * Per-request tRPC context. The host (Next route handler) verifies the identity
 * (Supabase) and passes the `AuthUser` in; the context then loads the DB profile
 * via the business layer to build the authoritative `Principal` (role/schoolId/
 * status from the DB, never the JWT — ADR-002). `api` never imports `@repo/db`.
 * The host may also inject a `StoragePort` (service-role signed-URL minting,
 * ADR-004); document upload/download procedures require it.
 */
export interface Context {
  user: Principal | null;
  /** Absent when the host wires no storage (tests, hosts without documents). */
  storage?: StoragePort | null | undefined;
  /** Correlation id for structured request logs (ADR-025 §3). `createContext`
   *  always sets it; optional so test callers can build a context without one. */
  requestId?: string;
}

export interface CreateContextOptions {
  authUser: AuthUser | null;
  storage?: StoragePort | undefined;
  /** Host may supply a correlation id (e.g. an inbound `x-request-id`); else generated. */
  requestId?: string | undefined;
}

export async function createContext({
  authUser,
  storage,
  requestId,
}: CreateContextOptions): Promise<Context> {
  const storagePort = storage ?? null;
  const id = requestId ?? crypto.randomUUID();
  if (!authUser) {
    return { user: null, storage: storagePort, requestId: id };
  }
  return { user: await resolvePrincipal(authUser.userId), storage: storagePort, requestId: id };
}
