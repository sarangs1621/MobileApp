import { prisma } from "./client";

/**
 * Lightweight DB connectivity check for readiness probes. Does not depend on any
 * model (works with the M0 model-free schema). Never throws — returns `false` on
 * any connection/query error so the probe can report NOT READY cleanly.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
