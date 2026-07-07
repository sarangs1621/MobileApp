import type { AttendanceCorrection, AttendanceStatus, CorrectionStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { AttendanceCorrection, CorrectionStatus };

export interface CreateAttendanceCorrectionInput {
  schoolId: string;
  attendanceRecordId: string;
  requestedByStaffId: string;
  previousStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  reason: string;
}

export interface DecideAttendanceCorrectionInput {
  status: CorrectionStatus;
  decidedByStaffId: string;
  decidedAt: Date;
}

/** Persistence for `AttendanceCorrection` (ADR-003, ADR-011). Request payload is
 *  immutable; only the decision fields transition. No authorization/rules here. */
export interface AttendanceCorrectionRepository {
  findById(id: string): Promise<AttendanceCorrection | null>;
  listByRecord(attendanceRecordId: string): Promise<AttendanceCorrection[]>;
  listPending(schoolId: string): Promise<AttendanceCorrection[]>;
  create(input: CreateAttendanceCorrectionInput): Promise<AttendanceCorrection>;
  decide(id: string, data: DecideAttendanceCorrectionInput): Promise<AttendanceCorrection>;
}

export function createAttendanceCorrectionRepository(
  client: DbClient,
): AttendanceCorrectionRepository {
  return {
    findById: (id) => client.attendanceCorrection.findUnique({ where: { id } }),
    listByRecord: (attendanceRecordId) =>
      client.attendanceCorrection.findMany({
        where: { attendanceRecordId },
        orderBy: { createdAt: "desc" },
      }),
    listPending: (schoolId) =>
      client.attendanceCorrection.findMany({
        where: { schoolId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      }),
    create: (input) => client.attendanceCorrection.create({ data: input }),
    decide: (id, data) =>
      client.attendanceCorrection.update({
        where: { id },
        data: {
          status: data.status,
          decidedByStaffId: data.decidedByStaffId,
          decidedAt: data.decidedAt,
        },
      }),
  };
}
