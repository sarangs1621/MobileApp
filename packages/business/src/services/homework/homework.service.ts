import { PERMISSIONS } from "@repo/constants";
import { ConflictError, ValidationError } from "@repo/core";
import type { HomeworkDto, HomeworkTargetDto } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";
import { activeYearId, isFullAccess } from "../people/scope";

import {
  assertHomeworkReadScope,
  assertOwnsHomework,
  assertOwnsSubjectSection,
  dueDateIst,
  istCalendarDate,
  isParent,
  loadHomeworkInSchool,
  mapHomework,
  parentVisibilityKeys,
  recordAudit,
  resolveActingStaffId,
} from "./scope";

export interface CreateHomeworkInput {
  subjectId: string;
  sectionId: string;
  title: string;
  description?: string | null | undefined;
  dueDate: Date;
}

export interface UpdateHomeworkInput {
  title?: string | undefined;
  description?: string | null | undefined;
  dueDate?: Date | undefined;
}

/**
 * A (subject × section) pair is valid iff a TeacherAssignment exists for it in this
 * school (ADR-013 §1). The list query is school-scoped, so a non-empty result also
 * proves both ids are real and in-tenant — no separate subject/section lookup needed
 * (Sections carry no schoolId; tenancy is via their Class).
 */
async function assertPairStaffed(
  ctx: ServiceContext,
  subjectId: string,
  sectionId: string,
): Promise<void> {
  const staffing = await ctx.repositories.teacherAssignments.list(ctx.user.schoolId, {
    subjectId,
    sectionId,
  });
  if (staffing.length === 0) {
    throw new ValidationError("No teacher is assigned to this subject in this section");
  }
}

/**
 * Create a DRAFT homework (admin or the owning teacher). Validates the
 * (subject × section) pair is staffed, derives ownership (teacher must hold the
 * assignment), and stamps `academicYearId` from the ACTIVE year — the cross-year
 * enforcement boundary (ADR-013 §1/§7). Audited.
 */
export async function createHomework(
  ctx: ServiceContext,
  input: CreateHomeworkInput,
): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const staffId = await resolveActingStaffId(ctx);
  await assertOwnsSubjectSection(ctx, input.subjectId, input.sectionId);
  await assertPairStaffed(ctx, input.subjectId, input.sectionId);
  if (!input.title.trim()) {
    throw new ValidationError("Title is required");
  }
  const yearId = await activeYearId(ctx);
  if (!yearId) {
    throw new ValidationError("No active academic year");
  }

  return ctx.withTransaction(async (repos) => {
    const created = await repos.homework.create({
      schoolId: ctx.user.schoolId,
      academicYearId: yearId,
      subjectId: input.subjectId,
      sectionId: input.sectionId,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate,
      createdByStaffId: staffId,
    });
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_CREATE",
      entityType: "Homework",
      entityId: created.id,
      after: { title: created.title, dueDate: dueDateIst(created.dueDate) },
    });
    return mapHomework(created);
  });
}

/**
 * Edit a homework (owning teacher/admin). DRAFT → title/description/dueDate freely.
 * PUBLISHED → dueDate EXTEND-ONLY (never below today IST or the current value);
 * content is frozen (ADR-013 §3). CLOSED → nothing. Audited.
 */
export async function updateHomework(
  ctx: ServiceContext,
  homeworkId: string,
  input: UpdateHomeworkInput,
): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertOwnsHomework(ctx, homework);

  if (homework.status === "CLOSED") {
    throw new ConflictError("A closed homework cannot be edited");
  }

  if (homework.status === "PUBLISHED") {
    if (input.title !== undefined || input.description !== undefined) {
      throw new ConflictError(
        "A published homework's content is frozen; only the due date may change",
      );
    }
    if (input.dueDate === undefined) {
      throw new ValidationError("Nothing to update");
    }
    const nextIst = dueDateIst(input.dueDate);
    if (nextIst < dueDateIst(homework.dueDate)) {
      throw new ValidationError("The due date can only be extended, not shortened");
    }
    if (nextIst < istCalendarDate(new Date())) {
      throw new ValidationError("The due date cannot be in the past");
    }
    return ctx.withTransaction(async (repos) => {
      const updated = await repos.homework.extendDueDate(homeworkId, input.dueDate!);
      if (!updated) {
        throw new ConflictError("Homework is no longer published");
      }
      await recordAudit(ctx, repos, {
        action: "HOMEWORK_EXTEND_DUE",
        entityType: "Homework",
        entityId: homeworkId,
        before: { dueDate: dueDateIst(homework.dueDate) },
        after: { dueDate: nextIst },
      });
      return mapHomework(updated);
    });
  }

  // DRAFT — free edit.
  if (input.title !== undefined && !input.title.trim()) {
    throw new ValidationError("Title is required");
  }
  return ctx.withTransaction(async (repos) => {
    const updated = await repos.homework.updateContent(homeworkId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    });
    if (!updated) {
      throw new ConflictError("Homework is no longer a draft");
    }
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_UPDATE",
      entityType: "Homework",
      entityId: homeworkId,
      after: { title: updated.title },
    });
    return mapHomework(updated);
  });
}

/**
 * DRAFT → PUBLISHED — the parent-visibility gate (ADR-013 §2). Rejects publishing
 * already-overdue homework (dueDate must be ≥ today IST). Guarded → a double-publish
 * is a Conflict. Sends NO notification (M6 excludes notifications). Audited.
 */
export async function publishHomework(
  ctx: ServiceContext,
  homeworkId: string,
): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const staffId = await resolveActingStaffId(ctx);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "DRAFT") {
    throw new ConflictError("Only a draft homework can be published");
  }
  if (dueDateIst(homework.dueDate) < istCalendarDate(new Date())) {
    throw new ValidationError("Cannot publish homework whose due date has already passed");
  }

  return ctx.withTransaction(async (repos) => {
    const published = await repos.homework.transition(homeworkId, "DRAFT", {
      status: "PUBLISHED",
      publishedByStaffId: staffId,
      publishedAt: new Date(),
    });
    if (!published) {
      throw new ConflictError("Homework was already published");
    }
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_PUBLISH",
      entityType: "Homework",
      entityId: homeworkId,
      before: { status: "DRAFT" },
      after: { status: "PUBLISHED" },
    });
    return mapHomework(published);
  });
}

/** PUBLISHED → CLOSED — submissions refused; review/feedback stay allowed. Guarded. Audited. */
export async function closeHomework(ctx: ServiceContext, homeworkId: string): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const staffId = await resolveActingStaffId(ctx);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "PUBLISHED") {
    throw new ConflictError("Only a published homework can be closed");
  }

  return ctx.withTransaction(async (repos) => {
    const closed = await repos.homework.transition(homeworkId, "PUBLISHED", {
      status: "CLOSED",
      closedByStaffId: staffId,
      closedAt: new Date(),
    });
    if (!closed) {
      throw new ConflictError("Homework was already closed");
    }
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_CLOSE",
      entityType: "Homework",
      entityId: homeworkId,
      before: { status: "PUBLISHED" },
      after: { status: "CLOSED" },
    });
    return mapHomework(closed);
  });
}

/**
 * CLOSED → PUBLISHED — the one audited backward transition (ADR-013 §2, M5 unlock
 * analog). Requires a reason; clears the close stamp (the CLOSED⟺closedAt CHECK).
 * Guarded. Audited.
 */
export async function reopenHomework(
  ctx: ServiceContext,
  input: { homeworkId: string; reason: string },
): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const staffId = await resolveActingStaffId(ctx);
  const homework = await loadHomeworkInSchool(ctx, input.homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "CLOSED") {
    throw new ConflictError("Only a closed homework can be reopened");
  }
  if (!input.reason.trim()) {
    throw new ValidationError("A reopen reason is required");
  }

  return ctx.withTransaction(async (repos) => {
    const reopened = await repos.homework.transition(input.homeworkId, "CLOSED", {
      status: "PUBLISHED",
      closedByStaffId: null,
      closedAt: null,
      reopenedByStaffId: staffId,
      reopenedAt: new Date(),
      reopenReason: input.reason,
    });
    if (!reopened) {
      throw new ConflictError("Homework is no longer closed");
    }
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_REOPEN",
      entityType: "Homework",
      entityId: input.homeworkId,
      before: { status: "CLOSED" },
      after: { status: "PUBLISHED", reason: input.reason },
    });
    return mapHomework(reopened);
  });
}

/**
 * Delete a homework — business-guarded to DRAFT only (ADR-013 §12, R5 analog). A
 * DRAFT structurally has no submissions, so the Cascade only wipes teacher draft
 * content. Published/closed homework is never deletable (close it instead). Audited.
 */
export async function deleteHomework(ctx: ServiceContext, homeworkId: string): Promise<void> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertOwnsHomework(ctx, homework);
  if (homework.status !== "DRAFT") {
    throw new ConflictError("Only a draft homework can be deleted");
  }

  await ctx.withTransaction(async (repos) => {
    const deleted = await repos.homework.deleteDraft(homeworkId);
    if (!deleted) {
      throw new ConflictError("Homework is no longer a draft");
    }
    await recordAudit(ctx, repos, {
      action: "HOMEWORK_DELETE",
      entityType: "Homework",
      entityId: homeworkId,
      before: { title: homework.title },
    });
  });
}

/**
 * The teacher's assignable (subject × section) targets, name-enriched — the create
 * picker + list labels (mobile). Admins hold HOMEWORK_MANAGE but have no
 * TeacherAssignment → empty (they create on web). ponytail: in-memory join over a
 * teacher's assignments, small N; batched by distinct id.
 */
export async function listHomeworkTargets(ctx: ServiceContext): Promise<HomeworkTargetDto[]> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_MANAGE);
  const assignments = await ctx.repositories.teacherAssignments.list(ctx.user.schoolId, {
    teacherId: ctx.user.userId,
  });
  if (assignments.length === 0) {
    return [];
  }
  const subjectName = new Map(
    (
      await Promise.all(
        [...new Set(assignments.map((a) => a.subjectId))].map((id) =>
          ctx.repositories.subjects.findById(id),
        ),
      )
    )
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => [s.id, s.name]),
  );
  const sectionName = new Map(
    (
      await Promise.all(
        [...new Set(assignments.map((a) => a.sectionId))].map((id) =>
          ctx.repositories.sections.findById(id),
        ),
      )
    )
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => [s.id, s.name]),
  );
  const seen = new Set<string>();
  const out: HomeworkTargetDto[] = [];
  for (const a of assignments) {
    const key = `${a.subjectId}:${a.sectionId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      subjectId: a.subjectId,
      subjectName: subjectName.get(a.subjectId) ?? "—",
      sectionId: a.sectionId,
      sectionName: sectionName.get(a.sectionId) ?? "—",
    });
  }
  return out;
}

/** One homework (read-scoped: admin any / teacher own / parent published own-child). */
export async function getHomework(ctx: ServiceContext, homeworkId: string): Promise<HomeworkDto> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_READ);
  const homework = await loadHomeworkInSchool(ctx, homeworkId);
  await assertHomeworkReadScope(ctx, homework);
  return mapHomework(homework);
}

export interface ListHomeworkInput {
  academicYearId?: string | undefined;
  sectionId?: string | undefined;
}

/**
 * Homework feed, role-scoped (ADR-013 §10):
 * - admin → a year's homework (all states), optionally narrowed to a section;
 * - teacher → own (subject × section) homework (all states);
 * - parent → PUBLISHED/CLOSED homework for a section an own child is enrolled in,
 *   OR any homework their child already submitted for (the transfer or-clause).
 */
export async function listHomework(
  ctx: ServiceContext,
  input: ListHomeworkInput = {},
): Promise<HomeworkDto[]> {
  assertCan(ctx.user, PERMISSIONS.HOMEWORK_READ);

  if (isFullAccess(ctx)) {
    if (input.sectionId) {
      const rows = await ctx.repositories.homework.listBySection(
        ctx.user.schoolId,
        input.sectionId,
      );
      return rows.map(mapHomework);
    }
    if (!input.academicYearId) {
      throw new ValidationError("academicYearId or sectionId is required");
    }
    const rows = await ctx.repositories.homework.listByYear(
      ctx.user.schoolId,
      input.academicYearId,
    );
    return rows.map(mapHomework);
  }

  if (isParent(ctx)) {
    const { sectionIds, submittedHomeworkIds } = await parentVisibilityKeys(ctx);
    if (sectionIds.length === 0 && submittedHomeworkIds.length === 0) {
      return [];
    }
    const rows = await ctx.repositories.homework.listForParent(
      ctx.user.schoolId,
      sectionIds,
      submittedHomeworkIds,
      ["PUBLISHED", "CLOSED"],
    );
    return rows.map(mapHomework);
  }

  // TEACHER — own subject×section across their assignments.
  const assignments = await ctx.repositories.teacherAssignments.list(ctx.user.schoolId, {
    teacherId: ctx.user.userId,
  });
  if (assignments.length === 0) {
    return [];
  }
  const ownedPairs = new Set(assignments.map((a) => `${a.subjectId}:${a.sectionId}`));
  const sectionIds = input.sectionId
    ? [input.sectionId]
    : [...new Set(assignments.map((a) => a.sectionId))];
  const rows = (
    await Promise.all(
      sectionIds.map((sid) => ctx.repositories.homework.listBySection(ctx.user.schoolId, sid)),
    )
  ).flat();
  return rows.filter((h) => ownedPairs.has(`${h.subjectId}:${h.sectionId}`)).map(mapHomework);
}
