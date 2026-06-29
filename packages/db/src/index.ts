/**
 * @repo/db — Prisma schema, client, migrations, seed, and repositories.
 * The ONLY package that may import `@prisma/client` (ADR-003, CODING_STANDARDS §5).
 */
export { prisma } from "./client";
export { pingDatabase } from "./health";
export { type Repositories } from "./repositories";
export type { PrismaClient } from "@prisma/client";
