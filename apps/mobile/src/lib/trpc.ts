import type { AppRouter } from "@repo/api";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import { env } from "../env";

import { supabase } from "./supabase";

/**
 * Typed tRPC React hooks over the shared AppRouter. `AppRouter` is a TYPE-ONLY
 * import — importing it as a value would drag the server graph (api→business→db→
 * Prisma) into the Metro bundle. `createTRPCReact` comes from @trpc/react-query.
 */
export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${env.EXPO_PUBLIC_API_URL}/api/trpc`,
        transformer: superjson,
        // Read the CURRENT session per request so a refreshed token is always used.
        async headers() {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
