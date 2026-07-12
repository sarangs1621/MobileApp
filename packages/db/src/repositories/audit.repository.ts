import type { Prisma } from "@prisma/client";

import type { DbClient } from "../db-client";

/**
 * An audit entry. `before`/`after` hold the CHANGED fields (JSON-safe), not whole
 * rows (ADR-007). The business layer builds these; the repository only persists.
 */
export interface AuditEntry {
  schoolId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/** Keyset-paginated audit read (M17 ops export). `before` = older-than cursor. */
export interface AuditLogListFilter {
  limit: number;
  before?: Date | undefined;
}

export interface AuditLogRow {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Prisma.JsonValue | null;
  afterJson: Prisma.JsonValue | null;
  createdAt: Date;
}

/** Append-only audit writer + read (read added M17 for the ops audit export). */
export interface AuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
  list(schoolId: string, filter: AuditLogListFilter): Promise<AuditLogRow[]>;
}

export function createAuditLogRepository(client: DbClient): AuditLogRepository {
  return {
    record: async (entry) => {
      await client.auditLog.create({
        data: {
          schoolId: entry.schoolId,
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          // Only set JSON columns when provided (strict optional properties).
          ...(entry.before !== undefined ? { beforeJson: entry.before } : {}),
          ...(entry.after !== undefined ? { afterJson: entry.after } : {}),
        },
      });
    },

    // Tenant-scoped, keyset-paginated by createdAt — uses @@index([schoolId, createdAt]).
    list: (schoolId, filter) =>
      client.auditLog.findMany({
        where: {
          schoolId,
          ...(filter.before ? { createdAt: { lt: filter.before } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: filter.limit,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          beforeJson: true,
          afterJson: true,
          createdAt: true,
        },
      }),
  };
}
