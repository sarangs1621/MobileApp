import { PERMISSIONS, STORAGE_BUCKETS } from "@repo/constants";
import type { AuditLogListFilter } from "@repo/db";

import { assertCan, type Principal } from "../../authorization";
import type { ServiceContext } from "../../context";
import { checkReadiness, type ReadinessReport } from "../../system";
import type { StoragePort } from "../people/document-storage.service";

/**
 * Super-Admin operational tooling (M17, ADR-025 §9). Every function is gated by
 * `system:manage` (SUPER_ADMIN only) and is READ-ONLY / non-destructive — none
 * modifies business data. Audit export reads the ADR-007 trail (tenant-scoped);
 * storage verification probes bucket reachability; diagnostics reads runtime state.
 */

/** Authorization-only guard, for transport-level ops (e.g. cache clear) that act
 *  outside the service/repository boundary. */
export function assertSystemManage(user: Principal): void {
  assertCan(user, PERMISSIONS.SYSTEM_MANAGE);
}

export interface Diagnostics {
  version: string;
  uptimeSeconds: number;
  environment: string;
  readiness: ReadinessReport;
}

/** Runtime diagnostics — version/uptime/environment + DB readiness. */
export async function getDiagnostics(ctx: ServiceContext): Promise<Diagnostics> {
  assertCan(ctx.user, PERMISSIONS.SYSTEM_MANAGE);
  return {
    version: process.env.APP_VERSION ?? "unknown",
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.APP_ENV ?? "unknown",
    readiness: await checkReadiness(),
  };
}

/** Tenant-scoped audit-log export (keyset-paginated). Reads only (ADR-007). */
export function exportAuditLog(ctx: ServiceContext, input: AuditLogListFilter) {
  assertCan(ctx.user, PERMISSIONS.SYSTEM_MANAGE);
  return ctx.repositories.audit.list(ctx.user.schoolId, input);
}

export interface BucketStatus {
  bucket: string;
  ok: boolean;
  error?: string;
}

/**
 * Verify each private bucket is reachable by minting a throwaway signed upload
 * URL (no object is created) — reuses the existing StoragePort, no new capability.
 */
export async function verifyStorage(
  ctx: ServiceContext,
  storage: StoragePort,
): Promise<BucketStatus[]> {
  assertCan(ctx.user, PERMISSIONS.SYSTEM_MANAGE);
  const buckets = Object.values(STORAGE_BUCKETS);
  return Promise.all(
    buckets.map(async (bucket): Promise<BucketStatus> => {
      try {
        await storage.createSignedUploadUrl(bucket, `.system-check/${crypto.randomUUID()}`);
        return { bucket, ok: true };
      } catch (err) {
        return { bucket, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
}
