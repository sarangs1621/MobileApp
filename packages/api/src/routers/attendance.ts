import {
  applyLeave,
  attendanceSummary,
  cancelLeave,
  createHoliday,
  createServiceContext,
  decideCorrection,
  decideLeaveAndNotify,
  deleteHoliday,
  findSession,
  listHolidays,
  listLeaveByEnrollment,
  listMyCorrections,
  listPendingCorrections,
  listPendingLeaves,
  listSessionRecords,
  lockSession,
  markAttendance,
  openSession,
  sessionRoster,
  studentAttendanceHistory,
  submitCorrection,
  submitSession,
} from "@repo/business";
import {
  academicYearIdInput,
  applyLeaveInput,
  attendanceRangeInput,
  createHolidayInput,
  decideCorrectionInput,
  decideLeaveInput,
  enrollmentIdInput,
  findSessionInput,
  idInput,
  leaveIdInput,
  markAttendanceInput,
  openSessionInput,
  sessionIdInput,
  submitCorrectionInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Attendance-management procedures (M4). Thin transport only — validate (Zod)
 * then delegate to a business service; the service enforces permission + row
 * scope (teacher → own-section, parent → own-child), the DRAFT→SUBMITTED→LOCKED
 * state machine, holiday/leave rules, and writes audit in-transaction
 * (ADR-002/007/011). No logic, no role strings, no Prisma. All on
 * `protectedProcedure` (ACTIVE); gated by attendance/leave permissions in-service.
 */

export const attendanceRouter = router({
  openSession: protectedProcedure
    .input(openSessionInput)
    .mutation(({ ctx, input }) => openSession(createServiceContext(ctx.user), input)),
  /** Resolve today's register (or null) without creating one — decides open vs. resume. */
  findSession: protectedProcedure
    .input(findSessionInput)
    .query(({ ctx, input }) => findSession(createServiceContext(ctx.user), input)),
  /** Marking roster: ACTIVE enrollments + existing marks + leave-derived defaults. */
  roster: protectedProcedure
    .input(sessionIdInput)
    .query(({ ctx, input }) => sessionRoster(createServiceContext(ctx.user), input.sessionId)),
  mark: protectedProcedure
    .input(markAttendanceInput)
    .mutation(({ ctx, input }) => markAttendance(createServiceContext(ctx.user), input)),
  submit: protectedProcedure
    .input(sessionIdInput)
    .mutation(({ ctx, input }) => submitSession(createServiceContext(ctx.user), input.sessionId)),
  lock: protectedProcedure
    .input(sessionIdInput)
    .mutation(({ ctx, input }) => lockSession(createServiceContext(ctx.user), input.sessionId)),
  records: protectedProcedure
    .input(sessionIdInput)
    .query(({ ctx, input }) => listSessionRecords(createServiceContext(ctx.user), input.sessionId)),
  /** One enrollment's records over a date range (in scope). */
  history: protectedProcedure
    .input(attendanceRangeInput)
    .query(({ ctx, input }) => studentAttendanceHistory(createServiceContext(ctx.user), input)),
  /** Compute-on-read attendance % (ADR-011 §10 — no table, no cron). */
  summary: protectedProcedure
    .input(attendanceRangeInput)
    .query(({ ctx, input }) => attendanceSummary(createServiceContext(ctx.user), input)),
});

export const leaveRouter = router({
  // `apply` is reserved by tRPC (a Function.prototype method) — use `create`.
  create: protectedProcedure
    .input(applyLeaveInput)
    .mutation(({ ctx, input }) => applyLeave(createServiceContext(ctx.user), input)),
  // M12 (ADR-020 §3): repointed to the *AndNotify composer so an approve/reject
  // notifies the parent. The frozen M4 decideLeave is UNCHANGED — the composer calls it.
  decide: protectedProcedure
    .input(decideLeaveInput)
    .mutation(({ ctx, input }) => decideLeaveAndNotify(createServiceContext(ctx.user), input)),
  cancel: protectedProcedure
    .input(leaveIdInput)
    .mutation(({ ctx, input }) => cancelLeave(createServiceContext(ctx.user), input.leaveId)),
  listByEnrollment: protectedProcedure
    .input(enrollmentIdInput)
    .query(({ ctx, input }) =>
      listLeaveByEnrollment(createServiceContext(ctx.user), input.enrollmentId),
    ),
  /** School-wide pending leave queue (admin approval). */
  listPending: protectedProcedure.query(({ ctx }) =>
    listPendingLeaves(createServiceContext(ctx.user)),
  ),
});

export const attendanceCorrectionRouter = router({
  submit: protectedProcedure
    .input(submitCorrectionInput)
    .mutation(({ ctx, input }) => submitCorrection(createServiceContext(ctx.user), input)),
  decide: protectedProcedure
    .input(decideCorrectionInput)
    .mutation(({ ctx, input }) => decideCorrection(createServiceContext(ctx.user), input)),
  listPending: protectedProcedure.query(({ ctx }) =>
    listPendingCorrections(createServiceContext(ctx.user)),
  ),
  /** The caller's own submitted corrections + status (mobile teacher view). */
  listMine: protectedProcedure.query(({ ctx }) =>
    listMyCorrections(createServiceContext(ctx.user)),
  ),
});

export const holidayRouter = router({
  list: protectedProcedure
    .input(academicYearIdInput)
    .query(({ ctx, input }) => listHolidays(createServiceContext(ctx.user), input.academicYearId)),
  create: protectedProcedure
    .input(createHolidayInput)
    .mutation(({ ctx, input }) => createHoliday(createServiceContext(ctx.user), input)),
  delete: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deleteHoliday(createServiceContext(ctx.user), input.id)),
});
