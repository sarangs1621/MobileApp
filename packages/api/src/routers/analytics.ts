import {
  atRiskStudents,
  attendanceTrend,
  classPerformance,
  createServiceContext,
  dashboard,
  examTrend,
  feeCollection,
  schoolSummary,
  studentSummary,
  teacherSummary,
  topPerformers,
} from "@repo/business";
import {
  feeCollectionInput,
  sectionIdInput,
  studentIdInput,
  topPerformersInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Analytics & reporting procedures (M14, ADR-022). Thin transport only — validate
 * (Zod) then delegate; the business service enforces authorization by REUSING the
 * underlying domain read + scope (no analytics permission — ADR-022 §1). Everything is
 * computed live, read-only; no Prisma, no logic here. `dashboard` self-authorizes per
 * panel (§9).
 */
export const analyticsRouter = router({
  /* ---- student (parent own-child / admin any) ---- */
  studentSummary: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) => studentSummary(createServiceContext(ctx.user), input)),
  examTrend: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) => examTrend(createServiceContext(ctx.user), input)),
  attendanceTrend: protectedProcedure
    .input(studentIdInput)
    .query(({ ctx, input }) => attendanceTrend(createServiceContext(ctx.user), input)),

  /* ---- teacher (own sections) ---- */
  teacherSummary: protectedProcedure.query(({ ctx }) =>
    teacherSummary(createServiceContext(ctx.user)),
  ),
  classPerformance: protectedProcedure
    .input(sectionIdInput)
    .query(({ ctx, input }) => classPerformance(createServiceContext(ctx.user), input)),

  /* ---- admin (school-wide) ---- */
  schoolSummary: protectedProcedure.query(({ ctx }) =>
    schoolSummary(createServiceContext(ctx.user)),
  ),
  feeCollection: protectedProcedure
    .input(feeCollectionInput)
    .query(({ ctx, input }) => feeCollection(createServiceContext(ctx.user), input)),
  topPerformers: protectedProcedure
    .input(topPerformersInput)
    .query(({ ctx, input }) => topPerformers(createServiceContext(ctx.user), input)),
  atRiskStudents: protectedProcedure.query(({ ctx }) =>
    atRiskStudents(createServiceContext(ctx.user)),
  ),

  /* ---- composite (role-aware, self-authorizing) ---- */
  dashboard: protectedProcedure.query(({ ctx }) => dashboard(createServiceContext(ctx.user))),
});
