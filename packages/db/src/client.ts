import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient instance. Reused across hot-reloads in dev to avoid
 * exhausting connections. This is the ONLY place the client is constructed;
 * everything else goes through repositories (ADR-003).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
