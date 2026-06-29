import { hasRole } from "@repo/auth";
import type { RoleKey } from "@repo/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Context } from "./context";

/**
 * tRPC initialization. `superjson` preserves Dates/etc. across the wire; the
 * error formatter surfaces Zod field errors so forms can map them
 * (API_CONVENTIONS.md §6).
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

/** Open to anyone (e.g. health). */
export const publicProcedure = t.procedure;

/** Requires an authenticated user; narrows `ctx.user` to non-null downstream. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { user: ctx.user } });
});

/**
 * Coarse role gate. Fine-grained scope (own division, linked students, …) is
 * enforced in the business layer, never here (Dev PRD §4.4).
 */
export function roleProcedure(...allowed: RoleKey[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasRole(ctx.user, allowed)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next();
  });
}
