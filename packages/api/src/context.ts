import type { AuthUser } from "@repo/auth";

/**
 * Per-request tRPC context. The host (Next route handler / Expo client) resolves
 * the {@link AuthUser} from Supabase and passes it in; the API layer never reads
 * cookies or the DB directly (ADR-002).
 */
export interface Context {
  user: AuthUser | null;
}

export interface CreateContextOptions {
  user: AuthUser | null;
}

export function createContext({ user }: CreateContextOptions): Context {
  return { user };
}
