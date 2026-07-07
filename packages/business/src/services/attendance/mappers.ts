import type {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceSession,
  Holiday,
  LeaveRequest,
} from "@repo/db";
import type {
  AttendanceCorrectionDto,
  AttendanceRecordDto,
  AttendanceSessionDto,
  HolidayDto,
  IsoUtcString,
  IstDateString,
  LeaveRequestDto,
} from "@repo/types";

/** @db.Date → YYYY-MM-DD IST string. */
function toIstDate(date: Date): IstDateString {
  return date.toISOString().slice(0, 10) as IstDateString;
}

/** timestamp → UTC ISO string (rendered to IST at the edge), or null. */
function toIso(date: Date | null): IsoUtcString | null {
  return date ? (date.toISOString() as IsoUtcString) : null;
}

export function mapAttendanceSession(r: AttendanceSession): AttendanceSessionDto {
  return {
    id: r.id,
    schoolId: r.schoolId,
    academicYearId: r.academicYearId,
    sectionId: r.sectionId,
    subjectId: r.subjectId,
    sessionType: r.sessionType,
    date: toIstDate(r.date),
    status: r.status,
    createdByStaffId: r.createdByStaffId,
    submittedByStaffId: r.submittedByStaffId,
    lockedByStaffId: r.lockedByStaffId,
    submittedAt: toIso(r.submittedAt),
    lockedAt: toIso(r.lockedAt),
  };
}

export function mapAttendanceRecord(r: AttendanceRecord): AttendanceRecordDto {
  return {
    id: r.id,
    schoolId: r.schoolId,
    sessionId: r.sessionId,
    enrollmentId: r.enrollmentId,
    status: r.status,
    remarks: r.remarks,
  };
}

export function mapLeaveRequest(r: LeaveRequest): LeaveRequestDto {
  return {
    id: r.id,
    schoolId: r.schoolId,
    enrollmentId: r.enrollmentId,
    parentId: r.parentId,
    fromDate: toIstDate(r.fromDate),
    toDate: toIstDate(r.toDate),
    reason: r.reason,
    status: r.status,
    decidedByStaffId: r.decidedByStaffId,
    decidedAt: toIso(r.decidedAt),
  };
}

export function mapAttendanceCorrection(r: AttendanceCorrection): AttendanceCorrectionDto {
  return {
    id: r.id,
    schoolId: r.schoolId,
    attendanceRecordId: r.attendanceRecordId,
    requestedByStaffId: r.requestedByStaffId,
    previousStatus: r.previousStatus,
    requestedStatus: r.requestedStatus,
    reason: r.reason,
    status: r.status,
    decidedByStaffId: r.decidedByStaffId,
    decidedAt: toIso(r.decidedAt),
  };
}

export function mapHoliday(r: Holiday): HolidayDto {
  return {
    id: r.id,
    schoolId: r.schoolId,
    academicYearId: r.academicYearId,
    name: r.name,
    date: toIstDate(r.date),
    type: r.type,
  };
}
