import { appRouter, createContext } from "@repo/api";
import { createServerClient, getAuthUser } from "@repo/auth";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { cookies } from "next/headers";

import { env } from "@/src/env";

/**
 * tRPC HTTP endpoint. Resolves the Supabase session from cookies into the
 * request's AuthUser, then delegates to the shared appRouter (ADR-002).
 */
function handler(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          getAll: () => cookieStore.getAll(),
          // Route handlers can't mutate cookies; session refresh is handled in
          // middleware when auth flows land (M1).
          setAll: () => undefined,
        },
      );
      const user = await getAuthUser(supabase);
      return createContext({ user });
    },
  });
}

export { handler as GET, handler as POST };
