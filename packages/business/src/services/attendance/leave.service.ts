import { PERMISSIONS } from "@repo/constants";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type { LeaveRequest } from "@repo/db";
import type { LeaveRequestDto, PendingLeaveDto } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";

import { mapLeaveRequest } from "./mappers";
import {
  assertEnrollmentInScope,
  loadEnrollmentInSchool,
  recordAudit,
  resolveActingStaffId,
  studentNameForEnrollment,
  toIstDateString,
} from "./scope";

export interface ApplyLeaveInput {
  enrollmentId: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
}

/** Parent applies for their own child's leave. Creates a PENDING request; writes
 *  no attendance (ADR-011 §7 — leave only biases the marking default). */
export async function applyLeave(
  ctx: ServiceContext,
  input: ApplyLeaveInput,
): Promise<LeaveRequestDto> {
  assertCan(ctx.user, PERMISSIONS.LEAVE_APPLY);

  const parent = await ctx.repositories.parents.findByUserId(ctx.user.userId);
  if (!parent) {
    throw new ForbiddenError("Only a parent may apply for leave");
  }
  const enrollment = await loadEnrollmentInSchool(ctx, input.enrollmentId);
  await assertEnrollmentInScope(ctx, enrollment); // parent → own child
  if (enrollment.status !== "ACTIVE") {
    throw new ValidationError("Leave can only be applied for an active enrollment");
  }
  if (input.fromDate.getTime() > input.toDate.getTime()) {
    throw new ValidationError("Leave start date must not be after the end date");
  }

  return ctx.withTransaction(async (repos) => {
    const created = await repos.leaveRequests.create({
      schoolId: ctx.user.schoolId,
      enrollmentId: input.enrollmentId,
      parentId: parent.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
    });
    await recordAudit(ctx, repos, {
      action: "LEAVE_APPLY",
      entityType: "LeaveRequest",
      entityId: created.id,
      after: {
        enrollmentId: created.enrollmentId,
        fromDate: toIstDateString(input.fromDate),
        toDate: toIstDateString(input.toDate),
      },
    });
    return mapLeaveRequest(created);
  });
}

/**
 * Approve or reject a PENDING leave request. Does NOT write or overwrite any
 * AttendanceRecord (ADR-011 §7); the approval only stamps the decision. Approved
 * leave surfaces as the marking-time default (see AttendanceService.sessionRoster).
 */
export async function decideLeave(
  ctx: ServiceContext,
  input: { leaveId: string; decision: "APPROVED" | "REJECTED" },
): Promise<LeaveRequestDto> {
  assertCan(ctx.user, PERMISSIONS.LEAVE_DECIDE);
  const staffId = await resolveActingStaffId(ctx);
  const leave = await loadLeaveInSchool(ctx, input.leaveId);
  if (leave.status !== "PENDING") {
    throw new ConflictError(`Leave is already ${leave.status.toLowerCase()}`);
  }

  return ctx.withTransaction(async (repos) => {
    const after = await repos.leaveRequests.update(leave.id, {
      status: input.decision,
      decidedByStaffId: staffId,
      decidedAt: new Date(),
    });
    await recordAudit(ctx, repos, {
      action: input.decision === "APPROVED" ? "LEAVE_APPROVE" : "LEAVE_REJECT",
      entityType: "LeaveRequest",
      entityId: leave.id,
      before: { status: leave.status },
      after: { status: after.status },
    });
    return mapLeaveRequest(after);
  });
}

/** Parent cancels their own still-PENDING request. */
export async function cancelLeave(ctx: ServiceContext, leaveId: string): Promise<LeaveRequestDto> {
  assertCan(ctx.user, PERMISSIONS.LEAVE_APPLY);
  const parent = await ctx.repositories.parents.findByUserId(ctx.user.userId);
  const leave = await loadLeaveInSchool(ctx, leaveId);
  if (!parent || leave.parentId !== parent.id) {
    throw new ForbiddenError("Not your leave request");
  }
  if (leave.status !== "PENDING") {
    throw new ConflictError(`Leave is already ${leave.status.toLowerCase()}`);
  }

  return ctx.withTransaction(async (repos) => {
    const after = await repos.leaveRequests.update(leave.id, { status: "CANCELLED" });
    await recordAudit(ctx, repos, {
      action: "LEAVE_CANCEL",
      entityType: "LeaveRequest",
      entityId: leave.id,
      before: { status: leave.status },
      after: { status: after.status },
    });
    return mapLeaveRequest(after);
  });
}

/** School-wide pending leave queue for approvers, enriched with the child's name. */
export async function listPendingLeaves(ctx: ServiceContext): Promise<PendingLeaveDto[]> {
  assertCan(ctx.user, PERMISSIONS.LEAVE_DECIDE);
  const rows = await ctx.repositories.leaveRequests.listPending(ctx.user.schoolId);
  return Promise.all(
    rows.map(async (row) => ({
      ...mapLeaveRequest(row),
      studentName: await studentNameForEnrollment(ctx, row.enrollmentId),
    })),
  );
}

/** Leave history for one enrollment (parent → own child; teacher → own section). */
export async function listLeaveByEnrollment(
  ctx: ServiceContext,
  enrollmentId: string,
): Promise<LeaveRequestDto[]> {
  assertCan(ctx.user, PERMISSIONS.LEAVE_READ);
  const enrollment = await loadEnrollmentInSchool(ctx, enrollmentId);
  await assertEnrollmentInScope(ctx, enrollment);
  const rows = await ctx.repositories.leaveRequests.listByEnrollment(enrollmentId);
  return rows.map(mapLeaveRequest);
}

/* ---- internal ---- */

async function loadLeaveInSchool(ctx: ServiceContext, id: string): Promise<LeaveRequest> {
  const row = await ctx.repositories.leaveRequests.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Leave request not found");
  }
  return row;
}
