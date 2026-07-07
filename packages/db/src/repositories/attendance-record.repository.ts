import type { AttendanceRecord, AttendanceStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { AttendanceRecord, AttendanceStatus };

export interface UpsertAttendanceRecordInput {
  schoolId: string;
  sessionId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

/** Persistence for `AttendanceRecord` (ADR-003, ADR-011). No authorization/rules. */
export interface AttendanceRecordRepository {
  findById(id: string): Promise<AttendanceRecord | null>;
  listBySession(sessionId: string): Promise<AttendanceRecord[]>;
  /** Records for one enrollment whose SESSION date falls in [from, to] (summary/history). */
  listByEnrollmentInRange(enrollmentId: string, from: Date, to: Date): Promise<AttendanceRecord[]>;
  /** Idempotent mark: one row per (session, enrollment) — re-submit updates in place. */
  upsert(input: UpsertAttendanceRecordInput): Promise<AttendanceRecord>;
  /** Set status/remarks by id (correction approval). */
  updateStatus(id: string, status: AttendanceStatus): Promise<AttendanceRecord>;
}

export function createAttendanceRecordRepository(client: DbClient): AttendanceRecordRepository {
  return {
    findById: (id) => client.attendanceRecord.findUnique({ where: { id } }),
    listBySession: (sessionId) =>
      client.attendanceRecord.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
    listByEnrollmentInRange: (enrollmentId, from, to) =>
      client.attendanceRecord.findMany({
        where: { enrollmentId, session: { date: { gte: from, lte: to } } },
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
      }),
    updateStatus: (id, status) =>
      client.attendanceRecord.update({ where: { id }, data: { status } }),
  };
}
