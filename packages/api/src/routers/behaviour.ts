import {
  closeBehaviourIncident,
  createBehaviourIncident,
  createServiceContext,
  getBehaviourIncident,
  listBehaviourByStudent,
  listBehaviourByTeacher,
  listIncidents,
  resolveBehaviourIncident,
  updateBehaviourIncident,
} from "@repo/business";
import {
  createBehaviourIncidentInput,
  idInput,
  listBehaviourByStudentInput,
  listBehaviourByTeacherInput,
  listIncidentsInput,
  updateBehaviourIncidentInput,
} from "@repo/validation";

import { protectedProcedure, router } from "../trpc";

/**
 * Student discipline procedures (M12, ADR-020). Thin transport only — validate (Zod)
 * then delegate; the business service enforces permission (behaviour:manage/record/read),
 * author + student scope, the lifecycle transition graph, in-tx audit, and the optional
 * post-commit M10 notification to the student's parents. No logic, no role strings, no Prisma.
 */
export const behaviourRouter = router({
  /** Admin console — school-wide, filterable by student / teacher / status / severity. */
  list: protectedProcedure
    .input(listIncidentsInput)
    .query(({ ctx, input }) => listIncidents(createServiceContext(ctx.user), input)),
  /** A student's discipline history (admin all; teacher own-section; parent own child). */
  listByStudent: protectedProcedure.input(listBehaviourByStudentInput).query(({ ctx, input }) => {
    const { studentId, ...rest } = input;
    return listBehaviourByStudent(createServiceContext(ctx.user), studentId, rest);
  }),
  /** The acting teacher's own referrals. */
  listByTeacher: protectedProcedure
    .input(listBehaviourByTeacherInput)
    .query(({ ctx, input }) => listBehaviourByTeacher(createServiceContext(ctx.user), input)),
  /** One incident, scope-gated. */
  get: protectedProcedure
    .input(idInput)
    .query(({ ctx, input }) => getBehaviourIncident(createServiceContext(ctx.user), input.id)),

  /* ---- lifecycle (admin any; teacher own students/incidents) ---- */
  create: protectedProcedure
    .input(createBehaviourIncidentInput)
    .mutation(({ ctx, input }) => createBehaviourIncident(createServiceContext(ctx.user), input)),
  update: protectedProcedure.input(updateBehaviourIncidentInput).mutation(({ ctx, input }) => {
    const { id, ...rest } = input;
    return updateBehaviourIncident(createServiceContext(ctx.user), id, rest);
  }),
  /** OPEN/IN_PROGRESS → RESOLVED (stamps resolver). */
  resolve: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) =>
      resolveBehaviourIncident(createServiceContext(ctx.user), input.id),
    ),
  /** → CLOSED (terminal; immutable thereafter). */
  close: protectedProcedure
    .input(idInput)
    .mutation(({ ctx, input }) => closeBehaviourIncident(createServiceContext(ctx.user), input.id)),
});
