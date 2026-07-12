import { PERMISSIONS } from "@repo/constants";
import {
  can,
  ConflictError,
  errorFields,
  ForbiddenError,
  logger,
  NotFoundError,
  ValidationError,
} from "@repo/core";
import type { BehaviourIncident } from "@repo/db";
import type {
  BehaviourCategoryKey,
  BehaviourIncidentDto,
  BehaviourSeverityKey,
  BehaviourStatusKey,
  NotificationPriorityKey,
} from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { createBulkNotification } from "../notification/notification.service";
import { parentUserIdsForStudent } from "../notification/recipients";
import { activeYearId, assertStudentInScope, loadStudentInSchool } from "../people/scope";

import { mapBehaviourIncident } from "./mappers";
import {
  assertCanReadIncident,
  isFullAccess,
  loadIncidentInSchool,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** HIGH/CRITICAL incidents notify at HIGH priority; the rest at NORMAL (ADR-020 §3). */
function severityToPriority(severity: BehaviourSeverityKey): NotificationPriorityKey {
  return severity === "CRITICAL" || severity === "HIGH" ? "HIGH" : "NORMAL";
}

export interface CreateBehaviourInput {
  studentId: string;
  /** Admin only: pin an explicit enrollment (any year). Ignored on the teacher path —
   *  there the ACTIVE-year enrollment is derived server-side (year/section context). */
  enrollmentId?: string | undefined;
  category: BehaviourCategoryKey;
  severity: BehaviourSeverityKey;
  title: string;
  description: string;
  actionTaken?: string | null | undefined;
  /** Admin path only: the referring teacher's User id. Ignored on the teacher path (self). */
  teacherId?: string | undefined;
  /** Optional M10 fan-out to the student's parents (default true). */
  notify?: boolean | undefined;
}

export interface UpdateBehaviourInput {
  category?: BehaviourCategoryKey | undefined;
  severity?: BehaviourSeverityKey | undefined;
  title?: string | undefined;
  description?: string | undefined;
  actionTaken?: string | null | undefined;
  /** Only OPEN↔IN_PROGRESS here; RESOLVED/CLOSED go through resolve()/close(). */
  status?: Extract<BehaviourStatusKey, "OPEN" | "IN_PROGRESS"> | undefined;
}

/**
 * Behaviour authorship gate (ADR-020 §6). Admin (behaviour:manage) records for any
 * student and names the referring teacher; a teacher (behaviour:record) records only
 * for OWN students, and `teacherId` is SERVER-SET to self (never client-supplied —
 * the own-incident RLS/scope model depends on it). Returns the teacherId to store.
 */
async function assertCanRecordBehaviour(
  ctx: ServiceContext,
  student: Awaited<ReturnType<typeof loadStudentInSchool>>,
  inputTeacherId: string | undefined,
): Promise<string> {
  if (can(ctx.user.role, PERMISSIONS.BEHAVIOUR_MANAGE)) {
    if (!inputTeacherId) {
      throw new ValidationError("A referring teacher (teacherId) is required");
    }
    const teacher = await ctx.repositories.users.findById(inputTeacherId);
    if (!teacher || teacher.schoolId !== ctx.user.schoolId || teacher.role !== "TEACHER") {
      throw new ValidationError("Referring teacher not found");
    }
    return inputTeacherId;
  }
  if (can(ctx.user.role, PERMISSIONS.BEHAVIOUR_RECORD)) {
    await assertStudentInScope(ctx, student); // teacher → own-section students only
    return ctx.user.userId; // server-set — the client cannot record "as" another teacher
  }
  throw new ForbiddenError(`Missing permission: ${PERMISSIONS.BEHAVIOUR_MANAGE}`);
}

/**
 * Resolve the incident's enrollment context. An admin may PIN an explicit enrollment
 * (validated to belong to the student); otherwise — always on the teacher path — the
 * student's ACTIVE-year enrollment is derived server-side, so `enrollmentId` can never
 * be a stale-year section the teacher never taught (ADR-020 §1).
 */
async function resolveIncidentEnrollment(
  ctx: ServiceContext,
  studentId: string,
  suppliedEnrollmentId: string | undefined,
) {
  if (suppliedEnrollmentId) {
    const e = await ctx.repositories.enrollments.findById(suppliedEnrollmentId);
    if (!e || e.schoolId !== ctx.user.schoolId) {
      throw new NotFoundError("Enrollment not found");
    }
    if (e.studentId !== studentId) {
      throw new ValidationError("Enrollment does not belong to the student");
    }
    return e;
  }
  const yearId = await activeYearId(ctx);
  if (!yearId) {
    throw new ConflictError("No active academic year to attach the incident to");
  }
  const e = await ctx.repositories.enrollments.findByStudentYear(studentId, yearId);
  if (!e) {
    throw new ValidationError("Student has no active-year enrollment for this incident");
  }
  return e;
}

/** Admin (manage) any incident; the owning teacher (teacherId = self) their own. */
function assertCanWriteIncident(ctx: ServiceContext, incident: BehaviourIncident): void {
  if (can(ctx.user.role, PERMISSIONS.BEHAVIOUR_MANAGE)) {
    return;
  }
  if (can(ctx.user.role, PERMISSIONS.BEHAVIOUR_RECORD) && incident.teacherId === ctx.user.userId) {
    return;
  }
  throw new ForbiddenError("Not your incident to modify");
}

/**
 * Record a behaviour incident (OPEN). Scoped author + student check, audited in-tx;
 * then, best-effort AFTER commit, optionally notifies the student's parents (M10
 * BEHAVIOUR, the canonical *AndNotify pattern) and flips parentNotified iff it landed.
 */
export async function createBehaviourIncident(
  ctx: ServiceContext,
  input: CreateBehaviourInput,
): Promise<BehaviourIncidentDto> {
  // Coarse permission gate BEFORE any data access (the fine-grained student scope
  // is checked in assertCanRecordBehaviour once the student is loaded).
  if (
    !can(ctx.user.role, PERMISSIONS.BEHAVIOUR_MANAGE) &&
    !can(ctx.user.role, PERMISSIONS.BEHAVIOUR_RECORD)
  ) {
    throw new ForbiddenError(`Missing permission: ${PERMISSIONS.BEHAVIOUR_MANAGE}`);
  }
  const student = await loadStudentInSchool(ctx, input.studentId);
  const teacherId = await assertCanRecordBehaviour(ctx, student, input.teacherId);
  const isAdmin = can(ctx.user.role, PERMISSIONS.BEHAVIOUR_MANAGE);
  // Teacher path NEVER trusts a client enrollmentId — derive it (advisor: stale-year guard).
  const enrollment = await resolveIncidentEnrollment(
    ctx,
    input.studentId,
    isAdmin ? input.enrollmentId : undefined,
  );
  const staffId = await resolveActingStaffId(ctx);

  const created = await ctx.withTransaction(async (repos) => {
    const row = await repos.behaviourIncidents.create({
      schoolId: ctx.user.schoolId,
      academicYearId: enrollment.academicYearId,
      studentId: input.studentId,
      enrollmentId: enrollment.id,
      teacherId,
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      actionTaken: input.actionTaken ?? null,
      createdByStaffId: staffId,
    });
    await recordAudit(ctx, repos, {
      action: "BEHAVIOUR_CREATE",
      entityType: "BehaviourIncident",
      entityId: row.id,
      after: { studentId: row.studentId, category: row.category, severity: row.severity },
    });
    return row;
  });

  if (input.notify !== false) {
    // Best-effort (ADR-018 §3 posture): a notification hiccup must not fail the committed create.
    try {
      const userIds = await parentUserIdsForStudent(ctx.repositories, created.studentId);
      const res = await createBulkNotification(ctx, {
        type: "BEHAVIOUR",
        priority: severityToPriority(created.severity),
        title: "Behaviour update",
        body: created.title,
        actionUrl: `/behaviour/${created.id}`,
        userIds,
      });
      if (res.recipientCount > 0) {
        // ponytail: the flag flip is intentionally unaudited (a best-effort delivery
        // marker, not a domain mutation — the emit's NOTIFICATION_CREATE already audits).
        const flagged = await ctx.repositories.behaviourIncidents.setParentNotified(
          created.id,
          true,
        );
        return mapBehaviourIncident(flagged);
      }
    } catch (err) {
      logger.error("behaviour notify failed", {
        route: "behaviour.create",
        incidentId: created.id,
        ...errorFields(err),
      });
    }
  }

  return mapBehaviourIncident(created);
}

/** Edit an OPEN/IN_PROGRESS incident (author-owned). CLOSED is immutable. Audited. */
export async function updateBehaviourIncident(
  ctx: ServiceContext,
  id: string,
  input: UpdateBehaviourInput,
): Promise<BehaviourIncidentDto> {
  const existing = await loadIncidentInSchool(ctx, id);
  if (existing.status === "CLOSED") {
    throw new ConflictError("A closed incident is immutable");
  }
  assertCanWriteIncident(ctx, existing);

  return ctx.withTransaction(async (repos) => {
    const updated = await repos.behaviourIncidents.update(id, {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.actionTaken !== undefined ? { actionTaken: input.actionTaken } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    await recordAudit(ctx, repos, {
      action: "BEHAVIOUR_UPDATE",
      entityType: "BehaviourIncident",
      entityId: id,
      after: { status: updated.status, severity: updated.severity },
    });
    return mapBehaviourIncident(updated);
  });
}

/** Mark an incident RESOLVED (stamps resolvedBy/resolvedAt — the CHECK gate). Audited. */
export async function resolveBehaviourIncident(
  ctx: ServiceContext,
  id: string,
): Promise<BehaviourIncidentDto> {
  const existing = await loadIncidentInSchool(ctx, id);
  assertCanWriteIncident(ctx, existing);
  if (existing.status === "CLOSED") {
    throw new ConflictError("A closed incident is immutable");
  }
  if (existing.status === "RESOLVED") {
    throw new ConflictError("Incident is already resolved");
  }
  const staffId = await resolveActingStaffId(ctx);

  return ctx.withTransaction(async (repos) => {
    const updated = await repos.behaviourIncidents.update(id, {
      status: "RESOLVED",
      resolvedByStaffId: staffId,
      resolvedAt: new Date(),
    });
    await recordAudit(ctx, repos, {
      action: "BEHAVIOUR_RESOLVE",
      entityType: "BehaviourIncident",
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return mapBehaviourIncident(updated);
  });
}

/**
 * Close an incident — terminal, immutable thereafter (ADR-020 §2). If it was never
 * resolved, close self-stamps resolvedBy/resolvedAt so the RESOLVED/CLOSED ⟹ stamps
 * CHECK holds. Audited.
 */
export async function closeBehaviourIncident(
  ctx: ServiceContext,
  id: string,
): Promise<BehaviourIncidentDto> {
  const existing = await loadIncidentInSchool(ctx, id);
  assertCanWriteIncident(ctx, existing);
  if (existing.status === "CLOSED") {
    throw new ConflictError("Incident is already closed");
  }
  const staffId = await resolveActingStaffId(ctx);

  return ctx.withTransaction(async (repos) => {
    const updated = await repos.behaviourIncidents.update(id, {
      status: "CLOSED",
      resolvedByStaffId: existing.resolvedByStaffId ?? staffId,
      resolvedAt: existing.resolvedAt ?? new Date(),
    });
    await recordAudit(ctx, repos, {
      action: "BEHAVIOUR_CLOSE",
      entityType: "BehaviourIncident",
      entityId: id,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return mapBehaviourIncident(updated);
  });
}

/** Read one incident, gated by scope (ADR-020 §5/§6). */
export async function getBehaviourIncident(
  ctx: ServiceContext,
  id: string,
): Promise<BehaviourIncidentDto> {
  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  const b = await loadIncidentInSchool(ctx, id);
  await assertCanReadIncident(ctx, b);
  return mapBehaviourIncident(b);
}

export interface ListIncidentsInput {
  studentId?: string | undefined;
  teacherId?: string | undefined;
  status?: BehaviourStatusKey | undefined;
  severity?: BehaviourSeverityKey | undefined;
  limit?: number | undefined;
  before?: string | undefined;
}

function pageArgs(input: { limit?: number | undefined; before?: string | undefined }) {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = input.before ? new Date(input.before) : undefined;
  return { limit, ...(before ? { before } : {}) };
}

/**
 * The admin behaviour CONSOLE (ADR-020 §6) — school-wide, filterable by student /
 * teacher / status / severity. Admin-only (behaviour:manage); teachers/parents use
 * the scoped listByStudent / listByTeacher wrappers.
 */
export async function listIncidents(
  ctx: ServiceContext,
  input: ListIncidentsInput = {},
): Promise<BehaviourIncidentDto[]> {
  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  if (!can(ctx.user.role, PERMISSIONS.BEHAVIOUR_MANAGE)) {
    throw new ForbiddenError(`Missing permission: ${PERMISSIONS.BEHAVIOUR_MANAGE}`);
  }
  const rows = await ctx.repositories.behaviourIncidents.list(ctx.user.schoolId, {
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.teacherId ? { teacherId: input.teacherId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.severity ? { severity: input.severity } : {}),
    ...pageArgs(input),
  });
  return rows.map(mapBehaviourIncident);
}

/**
 * A student's discipline history (ADR-020 §5) — admin all; teacher iff the student
 * is in an own section (own-section read, broader than the own-incident RLS on
 * purpose — business is the gate); parent iff own child.
 */
export async function listBehaviourByStudent(
  ctx: ServiceContext,
  studentId: string,
  input: { limit?: number | undefined; before?: string | undefined } = {},
): Promise<BehaviourIncidentDto[]> {
  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  const student = await loadStudentInSchool(ctx, studentId);
  if (!isFullAccess(ctx)) {
    await assertStudentInScope(ctx, student);
  }
  const rows = await ctx.repositories.behaviourIncidents.list(ctx.user.schoolId, {
    studentId,
    ...pageArgs(input),
  });
  return rows.map(mapBehaviourIncident);
}

/** The acting teacher's own referrals (teacherId = self; ADR-020 §5). */
export async function listBehaviourByTeacher(
  ctx: ServiceContext,
  input: { limit?: number | undefined; before?: string | undefined } = {},
): Promise<BehaviourIncidentDto[]> {
  assertCan(ctx.user, PERMISSIONS.BEHAVIOUR_READ);
  const rows = await ctx.repositories.behaviourIncidents.list(ctx.user.schoolId, {
    teacherId: ctx.user.userId,
    ...pageArgs(input),
  });
  return rows.map(mapBehaviourIncident);
}
