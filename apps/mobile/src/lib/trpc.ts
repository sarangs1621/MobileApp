import type { AppRouter } from "@repo/api";
import { refreshSession } from "@repo/auth";
import { createTRPCClient, httpBatchLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";

import { env } from "../env";

import { supabase } from "./supabase";

/**
 * Typed tRPC React hooks over the shared AppRouter. `AppRouter` is a TYPE-ONLY
 * import — importing it as a value would drag the server graph (api→business→db→
 * Prisma) into the Metro bundle. `createTRPCReact` comes from @trpc/react-query.
 */
export const trpc = createTRPCReact<AppRouter>();

/** True for a 401 / UNAUTHORIZED tRPC error (the token-refresh race, BUG-1). */
function isUnauthorized(err: unknown): boolean {
  if (err instanceof TRPCClientError) {
    const data = err.data as { code?: string; httpStatus?: number } | null | undefined;
    return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401;
  }
  return false;
}

/**
 * 401-aware refresh-and-retry link (fixes BUG-1, the ~14s stuck attendance roster).
 * Even though `headers()` reads the current session per request, a request fired
 * while the access token is mid-rotation still comes back `401`. On a 401 this link
 * refreshes the Supabase session ONCE (concurrent 401s share one in-flight refresh)
 * and retries the operation a single time. Sits before httpBatchLink so it wraps
 * every query and mutation.
 */
function refreshAuthLink(): TRPCLink<AppRouter> {
  let inFlight: Promise<void> | null = null;
  const refreshOnce = (): Promise<void> => {
    inFlight ??= refreshSession(supabase).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return () =>
    ({ op, next }) =>
      observable((observer) => {
        let retried = false;
        let sub: { unsubscribe: () => void } | undefined;
        const run = (): void => {
          sub = next(op).subscribe({
            next: (value) => observer.next(value),
            error: (err) => {
              if (!retried && isUnauthorized(err)) {
                retried = true;
                refreshOnce().then(run, () => observer.error(err));
                return;
              }
              observer.error(err);
            },
            complete: () => observer.complete(),
          });
        };
        run();
        return () => sub?.unsubscribe();
      });
}

function links() {
  return [
    refreshAuthLink(),
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
  ];
}

export function createTrpcClient() {
  return trpc.createClient({ links: links() });
}

/**
 * Vanilla (non-React) client for imperative calls outside components — e.g. logout,
 * which must deregister the device push token while still authenticated.
 */
export const trpcClient = createTRPCClient<AppRouter>({ links: links() });
