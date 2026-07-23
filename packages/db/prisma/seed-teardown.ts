import { PrismaClient } from "@prisma/client";
import { adminDeleteUser, adminFindUserId, createAdminClient } from "@repo/auth";

/**
 * QA teardown — removes EVERYTHING seeded (and anything created during QA), so
 * the database is clean before production infra is set up. It TRUNCATEs every
 * application table and deletes the seeded Supabase auth users.
 *
 * DESTRUCTIVE: run ONLY against the throwaway QA database, never production.
 * Guarded — set SEED_WIPE_CONFIRM=yes to proceed:
 *   SEED_WIPE_CONFIRM=yes pnpm --filter @repo/db seed:teardown
 *
 * Requires env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE.
 */

const STAFF_EMAILS = [
  "super@sgv.seed",
  "office@sgv.seed",
  "accountant@sgv.seed",
  "teacher@sgv.seed",
];
const PARENT_PHONE = "+919000000001";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.SEED_WIPE_CONFIRM !== "yes") {
    throw new Error(
      "Refusing to wipe. This TRUNCATEs the whole database — run against the QA database ONLY, " +
        "then set SEED_WIPE_CONFIRM=yes to proceed.",
    );
  }

  const prisma = new PrismaClient();
  const supabase = createAdminClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE"),
  );
  try {
    // 1) Truncate every application table (keeps Prisma migration history).
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (rows.length > 0) {
      const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
    console.warn(`[teardown] truncated ${rows.length} tables.`);

    // 2) Delete the seeded Supabase auth users.
    for (const email of STAFF_EMAILS) {
      const id = await adminFindUserId(supabase, { email });
      if (id) await adminDeleteUser(supabase, id);
    }
    const parentId = await adminFindUserId(supabase, { phone: PARENT_PHONE });
    if (parentId) await adminDeleteUser(supabase, parentId);
    console.warn("[teardown] deleted seeded auth users. Database is clean.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[teardown] failed:", error);
  process.exitCode = 1;
});
