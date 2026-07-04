import { createServerClient } from "@repo/auth";
import { cookies } from "next/headers";

import { env } from "@/src/env";

/**
 * Server Supabase client bound to the request cookies. Writes are ignored when
 * called from a Server Component (cookies are read-only there — the middleware
 * refreshes them); they take effect in Route Handlers / Server Actions.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component — safe to ignore (middleware refreshes).
      }
    },
  });
}
