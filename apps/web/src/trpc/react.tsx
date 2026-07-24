"use client";

import type { AppRouter } from "@repo/api";
import { refreshSession } from "@repo/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable } from "@trpc/server/observable";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import { getSupabaseClient } from "@/src/lib/supabase/client";

/** Typed tRPC React hooks (UI → hooks → API; ADR-002). */
export const trpc = createTRPCReact<AppRouter>();

/** True for a 401 / UNAUTHORIZED tRPC error (the SSR token-refresh race, BUG-1). */
function isUnauthorized(err: unknown): boolean {
  if (err instanceof TRPCClientError) {
    const data = err.data as { code?: string; httpStatus?: number } | null | undefined;
    return data?.code === "UNAUTHORIZED" || data?.httpStatus === 401;
  }
  return false;
}

/**
 * 401-aware refresh-and-retry link (fixes BUG-1). The Supabase SSR session refresh
 * (middleware `getUser()`) rotates the access token while batched tRPC requests are
 * in flight; those carry a stale/expiring token and come back `401`. On a 401 this
 * link refreshes the session ONCE — concurrent 401s share a single in-flight refresh
 * (single-flight) so a whole failed batch triggers just one rotation — then retries
 * the operation a single time. Sits before httpBatchLink, so it wraps every query
 * and mutation (the empty message-compose dropdown and the failed first send both
 * flowed through here).
 */
function refreshAuthLink(): TRPCLink<AppRouter> {
  let inFlight: Promise<void> | null = null;
  const refreshOnce = (): Promise<void> => {
    inFlight ??= refreshSession(getSupabaseClient()).finally(() => {
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

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Belt-and-suspenders alongside refreshAuthLink: a transient error still
        // gets one automatic retry rather than surfacing an empty/error state.
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [refreshAuthLink(), httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
