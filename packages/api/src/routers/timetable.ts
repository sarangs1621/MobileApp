import {
  createBellSchedule,
  createPeriod,
  createServiceContext,
  createTimetableEntry,
  deletePeriod,
  deleteTimetableEntry,
  getBellScheduleForYear,
  getParentTimetable,
  getSectionTimetable,
  getTeacherTimetable,
  getTodayTimetable,
  listPeriods,
  updateBellSchedule,
  updatePeriod,
  updateTimetableEntry,
} from "@repo/business";
import {
  academicYearIdInput,
  bellScheduleIdInput,
  createBellScheduleInput,
  createPeriodInput,
  createTimetableEntryInput,
  idInput,
  sectionTimetableInput,
  teacherTimetableInput,
  updateBellScheduleInput,
  updatePeriodInput,
  updateTimetableEntryInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Timetable Management procedures (M9, ADR-017). Thin transport only — validate
 * (Zod) then delegate to a business service; the service enforces permission +
 * scope, conflict detection, ownership (derived from TeacherAssignment), and writes
 * audit in-transaction (ADR-002/007). No logic, no role strings, no Prisma.
 * Permission-only gate (no feature flag — ADR-017 §4).
 */

/** `bellSchedule.*` — the year's day structure (one per year). */
export const bellScheduleRouter = router({
  /** The year's bell schedule, or null. */
  getForYear: protectedProcedure
    .input(academicYearIdInput)
    .query(({ ctx, input }) =>
      getBellScheduleForYear(createServiceContext(ctx.user), input.academicYearId),
    ),
  create: protectedProcedure
    .input(createBellScheduleInput)
    .mutation(({ ctx, input }) => createBellSchedule(createServiceContext(ctx.user), input)),
  update: protectedProcedure
    .input(updateBellScheduleInput)
    .mutation(({ ctx, input }) =>
      updateBellSchedule(createServiceContext(ctx.user), input.id, input.name),
    ),
});

/** `period.*` — numbered clock-time slots within the bell schedule. */
export const periodRouter = router({
  /** Periods of a schedule, in order. */
  list: protectedProcedure
    .input(bellScheduleIdInput)
    .query(({ ctx, input }) => listPeriods(createServiceContext(ctx.user), input.bellScheduleId)),
  create: protectedProcedure
    .input(createPeriodInput)
    .mutation(({ ctx, input }) => createPeriod(createServiceContext(ctx.user), input)),
  update: protectedProcedure
    .input(updatePeriodInput)
    .mutation(({ ctx, input: { id, ...rest } }) =>
      updatePeriod(createServiceContext(ctx.user), id, rest),
    ),
  delete: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deletePeriod(createServiceContext(ctx.user), input.id)),
});

/** `timetable.*` — weekly entries + section/teacher/parent/today read views. */
export const timetableRouter = router({
  createEntry: protectedProcedure
    .input(createTimetableEntryInput)
    .mutation(({ ctx, input }) => createTimetableEntry(createServiceContext(ctx.user), input)),
  updateEntry: protectedProcedure
    .input(updateTimetableEntryInput)
    .mutation(({ ctx, input: { id, ...rest } }) =>
      updateTimetableEntry(createServiceContext(ctx.user), id, rest),
    ),
  deleteEntry: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => deleteTimetableEntry(createServiceContext(ctx.user), input.id)),
  /** A section's weekly grid — admin any; parent own child's section (service scope). */
  bySection: protectedProcedure
    .input(sectionTimetableInput)
    .query(({ ctx, input }) =>
      getSectionTimetable(createServiceContext(ctx.user), input.academicYearId, input.sectionId),
    ),
  /** A teacher's weekly grid — admin any; teacher own only (service scope). */
  byTeacher: protectedProcedure
    .input(teacherTimetableInput)
    .query(({ ctx, input }) =>
      getTeacherTimetable(createServiceContext(ctx.user), input.academicYearId, input.teacherId),
    ),
  /** A parent's timetable — every section their children are ACTIVE in this year. */
  forParent: protectedProcedure
    .input(academicYearIdInput)
    .query(({ ctx, input }) =>
      getParentTimetable(createServiceContext(ctx.user), input.academicYearId),
    ),
  /** Today's classes (IST weekday) — teacher own; parent child's section. */
  today: protectedProcedure
    .input(academicYearIdInput)
    .query(({ ctx, input }) =>
      getTodayTimetable(createServiceContext(ctx.user), input.academicYearId),
    ),
});
