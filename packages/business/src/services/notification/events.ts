import type { ExamDto, HomeworkDto, LeaveRequestDto, ReportCardDto } from "@repo/types";

import type { ServiceContext } from "../../context";

import { createBulkNotification } from "./notification.service";
import {
  parentUserIdsForSection,
  parentUserIdsForStudent,
  teacherUserIdsForExam,
} from "./recipients";

/**
 * Notification EVENT INTEGRATION (M10 Step 5, ADR-018 §3). Each `emit*` is invoked
 * from the publish ROUTER *after* the frozen publish service has committed — the
 * existing business logic is untouched (the wrap is one post-commit call). Events
 * therefore never fire before commit; a legitimate re-publish (homework reopen,
 * report-card correction) emits again by design.
 *
 * Emission is BEST-EFFORT: the publish already succeeded and is durable, so a
 * notification failure is logged, never propagated — it must not fail (or appear
 * to fail) a committed publish. Timetable + study-material sources are deferred
 * (ADR-018 deviations #1/#2); announcement is a manual admin action (Step 6).
 */
async function safeEmit(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    // no-console allows warn/error; a real logger is a future concern.
    console.error(`[notifications] ${label} emit failed`, err);
  }
}

/** Homework published → parents of the section. */
export function emitHomeworkPublished(ctx: ServiceContext, hw: HomeworkDto): Promise<void> {
  return safeEmit("homework.published", async () => {
    const userIds = await parentUserIdsForSection(
      ctx.repositories,
      hw.academicYearId,
      hw.sectionId,
    );
    await createBulkNotification(ctx, {
      type: "HOMEWORK_PUBLISHED",
      title: "New homework",
      body: hw.title,
      actionUrl: `/homework/${hw.id}`,
      userIds,
    });
  });
}

/** Exam published → teachers assigned to the exam's sections. */
export function emitExamPublished(ctx: ServiceContext, exam: ExamDto): Promise<void> {
  return safeEmit("exam.published", async () => {
    const userIds = await teacherUserIdsForExam(ctx.repositories, ctx.user.schoolId, exam.id);
    await createBulkNotification(ctx, {
      type: "EXAM_PUBLISHED",
      title: "Exam results published",
      body: exam.name,
      actionUrl: `/exams/${exam.id}`,
      userIds,
    });
  });
}

/** Report card published → the card's parent(s). */
export function emitReportCardPublished(ctx: ServiceContext, card: ReportCardDto): Promise<void> {
  return safeEmit("reportCard.published", async () => {
    const enrollment = await ctx.repositories.enrollments.findById(card.enrollmentId);
    if (!enrollment) {
      return;
    }
    const userIds = await parentUserIdsForStudent(ctx.repositories, enrollment.studentId);
    await createBulkNotification(ctx, {
      type: "REPORT_CARD_PUBLISHED",
      priority: "HIGH",
      title: "Report card published",
      body: "Your child's report card is now available.",
      actionUrl: `/report-cards/${card.id}`,
      userIds,
    });
  });
}

/**
 * Leave approved/rejected → the requesting parent (M12, ADR-020 §3). Reuses the M10
 * emit; the frozen M4 `decideLeave` is untouched (the wrap composes it — see
 * publish-with-notify.ts). A parent without a login `userId` has no inbox → no-op.
 */
export function emitLeaveDecided(ctx: ServiceContext, leave: LeaveRequestDto): Promise<void> {
  return safeEmit("leave.decided", async () => {
    const parent = await ctx.repositories.parents.findById(leave.parentId);
    if (!parent?.userId) {
      return;
    }
    const approved = leave.status === "APPROVED";
    await createBulkNotification(ctx, {
      type: "LEAVE",
      title: approved ? "Leave approved" : "Leave rejected",
      body: approved
        ? "Your leave request has been approved."
        : "Your leave request has been rejected.",
      actionUrl: "/attendance/leave",
      userIds: [parent.userId],
    });
  });
}
