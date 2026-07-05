import { DomainError } from "@repo/core";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Context } from "./context";

/**
 * tRPC initialization. `superjson` preserves Dates/etc.; the error formatter
 * surfaces Zod field errors so forms can map them (API_CONVENTIONS.md §6).
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Domain error `code` → tRPC error code (API_CONVENTIONS.md §6). */
const DOMAIN_TO_TRPC: Record<
  string,
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST"
> = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  BAD_REQUEST: "BAD_REQUEST",
};

/**
 * Translate business `DomainError`s (thrown by services) into typed `TRPCError`s
 * so clients get FORBIDDEN/NOT_FOUND/… instead of a generic 500. Applied to every
 * procedure. Existing `TRPCError`s (e.g. the auth gates) pass through unchanged.
 *
 * tRPC middleware `next()` does NOT throw on downstream errors — it returns
 * `{ ok: false, error }` with the original exception wrapped as `error.cause`
 * (a plain try/catch here would never fire), so the mapping inspects the result.
 */
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof DomainError) {
    const domainError = result.error.cause;
    throw new TRPCError({
      code: DOMAIN_TO_TRPC[domainError.code] ?? "INTERNAL_SERVER_ERROR",
      message: domainError.message,
      cause: domainError,
    });
  }
  return result;
});

const baseProcedure = t.procedure.use(mapDomainErrors);

/** Open to anyone (e.g. health). */
export const publicProcedure = baseProcedure;

/**
 * Protected: authenticated **and** an `ACTIVE` profile. `INVITED` and `DISABLED`
 * are rejected — the latter enforces mid-session revocation despite a valid JWT.
 * All AUTHORIZATION (role → permission → scope) is decided in the business layer
 * against the DB-built `Principal`, never the request identity (ADR-002, §4.4).
 */
export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.user.status !== "ACTIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ctx.user.status === "DISABLED" ? "Account is disabled" : "Account is not activated",
    });
  }
  return next({ ctx: { user: ctx.user } });
});

/**
 * Protected + requires the host-wired `StoragePort` (signed-URL minting,
 * ADR-004). Hosts without storage (tests, misconfigured envs) get a clean
 * PRECONDITION_FAILED instead of a null-access 500. Authorization for WHAT may
 * be minted stays in the business layer.
 */
export const storageProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.storage) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "File storage is not configured",
    });
  }
  return next({ ctx: { storage: ctx.storage } });
});

/**
 * Onboarding path only: authenticated with an `INVITED` **or** `ACTIVE` profile
 * (`DISABLED` rejected). The seam `auth.registerProfile`/`auth.me` run on, so a
 * first-time INVITED user isn't locked out by the ACTIVE-only gate.
 */
export const onboardingProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.user.status === "DISABLED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account is disabled" });
  }
  return next({ ctx: { user: ctx.user } });
});
