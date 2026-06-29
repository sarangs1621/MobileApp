import { PrismaClient } from "@prisma/client";

/**
 * Seed infrastructure (Dev PRD §11). M0 has NO models, so there is nothing to
 * seed yet — this is the wired, runnable entry point. M1+ populates: one School,
 * a super-admin, the default (assumption-flagged) SCERT grade scale, the current
 * academic year, and feature flags for the contracted tier.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.warn("[seed] M0 foundation — no models to seed yet.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
});
