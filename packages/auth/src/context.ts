import type { RoleKey } from "@repo/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The authenticated principal. In M0 it carries identity from Supabase; `role`
 * and `schoolId` are enriched from the `User` profile in M1 (Dev PRD §4.3).
 */
export interface AuthUser {
  userId: string;
  email: string | null;
  phone: string | null;
  role?: RoleKey;
  schoolId?: string;
}

/** Resolve the verified user from a Supabase client, or `null` if unauthenticated. */
export async function getAuthUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    phone: data.user.phone ?? null,
  };
}
