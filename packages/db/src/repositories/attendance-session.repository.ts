import type {
  AttendanceSession,
  AttendanceSessionStatus,
  AttendanceSessionType,
} from "@prisma/client";

import type { DbClient } from "../db-client";

export type { AttendanceSession, AttendanceSessionStatus, AttendanceSessionType };

export interface CreateAttendanceSessionInput {
  schoolId: string;
  academicYearId: string;
  sectionId: string;
  subjectId?: string | null;
  sessionType: AttendanceSessionType;
  date: Date;
  createdByStaffId: string;
}

export interface UpdateAttendanceSessionInput {
  status?: AttendanceSessionStatus | undefined;
  submittedByStaffId?: string | null | undefined;
  submittedAt?: Date | null | undefined;
  lockedByStaffId?: string | null | undefined;
  lockedAt?: Date | null | undefined;
}

/** Persistence for `AttendanceSession` (ADR-003, ADR-011). No authorization/rules. */
export interface AttendanceSessionRepository {
  findById(id: string): Promise<AttendanceSession | null>;
  /** The existing register for a natural key (dup pre-check before the DB partial unique). */
  findExisting(
    sectionId: string,
    date: Date,
    sessionType: AttendanceSessionType,
    subjectId: string | null,
  ): Promise<AttendanceSession | null>;
  create(input: CreateAttendanceSessionInput): Promise<AttendanceSession>;
  update(id: string, data: UpdateAttendanceSessionInput): Promise<AttendanceSession>;
}

export function createAttendanceSessionRepository(client: DbClient): AttendanceSessionRepository {
  return {
    findById: (id) => client.attendanceSession.findUnique({ where: { id } }),
    findExisting: (sectionId, date, sessionType, subjectId) =>
      client.attendanceSession.findFirst({
        where: { sectionId, date, sessionType, subjectId },
      }),
    create: (input) =>
      client.attendanceSession.create({
        data: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          sectionId: input.sectionId,
          subjectId: input.subjectId ?? null,
          sessionType: input.sessionType,
          date: input.date,
          createdByStaffId: input.createdByStaffId,
        },
      }),
    update: (id, data) =>
      client.attendanceSession.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.submittedByStaffId !== undefined
            ? { submittedByStaffId: data.submittedByStaffId }
            : {}),
          ...(data.submittedAt !== undefined ? { submittedAt: data.submittedAt } : {}),
          ...(data.lockedByStaffId !== undefined ? { lockedByStaffId: data.lockedByStaffId } : {}),
          ...(data.lockedAt !== undefined ? { lockedAt: data.lockedAt } : {}),
        },
      }),
  };
}
