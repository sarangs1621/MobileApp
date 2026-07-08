/**
 * Attendance Management use-cases (M4). Attendance keys to Enrollment, never
 * Student (ADR-011 §1) — history survives promotion. Every mutation runs
 * permission → scope → rule checks and writes its AuditLog row in one
 * transaction (ADR-007). Session ownership derives from TeacherAssignment
 * (never stored); approved leave biases the marking default without eager
 * writes; corrections are immutable and update the record only on approval.
 */
export {
  openSession,
  findSession,
  sessionRoster,
  markAttendance,
  submitSession,
  lockSession,
  listSessionRecords,
  studentAttendanceHistory,
  attendanceSummary,
  type OpenSessionInput,
  type MarkInput,
  type MarkAttendanceInput,
} from "./attendance.service";
export {
  applyLeave,
  decideLeave,
  cancelLeave,
  listLeaveByEnrollment,
  listPendingLeaves,
  type ApplyLeaveInput,
} from "./leave.service";
export {
  submitCorrection,
  decideCorrection,
  listPendingCorrections,
  listMyCorrections,
  type SubmitCorrectionInput,
} from "./correction.service";
export {
  createHoliday,
  deleteHoliday,
  listHolidays,
  type CreateHolidayInput,
} from "./holiday.service";
