import type { AttendanceRecord, AttendanceStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { AttendanceRecord, AttendanceStatus };

/** A record joined with its session's date — the shape mapped to AttendanceRecordDto. */
export type AttendanceRecordWithDate = AttendanceRecord & { session: { date: Date } };

const withDate = { include: { session: { select: { date: true } } } } as const;

export interface UpsertAttendanceRecordInput {
  schoolId: string;
  sessionId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

/** Persistence for `AttendanceRecord` (ADR-003, ADR-011). No authorization/rules. */
export interface AttendanceRecordRepository {
  findById(id: string): Promise<AttendanceRecordWithDate | null>;
  listBySession(sessionId: string): Promise<AttendanceRecordWithDate[]>;
  /** Records for one enrollment whose SESSION date falls in [from, to] (summary/history). */
  listByEnrollmentInRange(
    enrollmentId: string,
    from: Date,
    to: Date,
  ): Promise<AttendanceRecordWithDate[]>;
  /** Idempotent mark: one row per (session, enrollment) — re-submit updates in place. */
  upsert(input: UpsertAttendanceRecordInput): Promise<AttendanceRecordWithDate>;
  /** Set status/remarks by id (correction approval). */
  updateStatus(id: string, status: AttendanceStatus): Promise<AttendanceRecord>;
}

export function createAttendanceRecordRepository(client: DbClient): AttendanceRecordRepository {
  return {
    findById: (id) => client.attendanceRecord.findUnique({ where: { id }, ...withDate }),
    listBySession: (sessionId) =>
      client.attendanceRecord.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        ...withDate,
      }),
    listByEnrollmentInRange: (enrollmentId, from, to) =>
      client.attendanceRecord.findMany({
        where: { enrollmentId, session: { date: { gte: from, lte: to } } },
        orderBy: { session: { date: "asc" } },
        ...withDate,
      }),
    upsert: (input) =>
      client.attendanceRecord.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId: input.sessionId,
            enrollmentId: input.enrollmentId,
          },
        },
        create: {
          schoolId: input.schoolId,
          sessionId: input.sessionId,
          enrollmentId: input.enrollmentId,
          status: input.status,
          remarks: input.remarks ?? null,
        },
        update: {
          status: input.status,
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        },
        ...withDate,
      }),
    updateStatus: (id, status) =>
      client.attendanceRecord.update({ where: { id }, data: { status } }),
  };
}
