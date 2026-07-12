import { pingDatabase } from "@repo/db";

/** Result of a readiness check — can this instance serve traffic? */
export interface ReadinessReport {
  ready: boolean;
  checks: {
    database: boolean;
    /** Present only when the host injects a storage ping (ADR-025 §4). */
    storage?: boolean;
  };
}

/**
 * Readiness: verifies the dependencies required to serve requests — DB
 * connectivity and, when the host supplies `pingStorage`, storage reachability
 * (ADR-025 §4). Used by the `/api/ready` probe via the API layer (the app never
 * touches @repo/db directly; the host owns the Supabase storage client per
 * ADR-004, so it injects the ping). Liveness is separate and dependency-free.
 */
export async function checkReadiness(
  pingStorage?: () => Promise<boolean>,
): Promise<ReadinessReport> {
  const database = await pingDatabase();
  const storage = pingStorage ? await pingStorage() : undefined;
  const ready = database && storage !== false;
  return {
    ready,
    checks: storage === undefined ? { database } : { database, storage },
  };
}
