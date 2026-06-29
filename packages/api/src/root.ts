import { checkReadiness } from "@repo/business";

import { publicProcedure, router } from "./trpc";

/**
 * The application router. M0 exposes only system probes; feature routers
 * (students, attendance, …) mount here per milestone (Dev PRD §7).
 */
export const appRouter = router({
  system: router({
    /** Liveness — the process is up. No dependency checks. */
    live: publicProcedure.query(() => ({
      status: "ok" as const,
      time: new Date().toISOString(),
    })),
    /** Readiness — dependencies (DB) are reachable; safe to receive traffic. */
    ready: publicProcedure.query(() => checkReadiness()),
  }),
});

export type AppRouter = typeof appRouter;
