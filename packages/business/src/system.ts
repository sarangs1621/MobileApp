import { pingDatabase } from "@repo/db";

/** Result of a readiness check — can this instance serve traffic? */
export interface ReadinessReport {
  ready: boolean;
  checks: {
    database: boolean;
  };
}

/**
 * Readiness: verifies the dependencies required to serve requests. In M0 that is
 * DB connectivity. Used by the `/api/ready` probe via the API layer (never the
 * app touching the DB directly). Liveness is separate and dependency-free.
 */
export async function checkReadiness(): Promise<ReadinessReport> {
  const database = await pingDatabase();
  return { ready: database, checks: { database } };
}
