import type { LeaveRequest, LeaveStatus } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { LeaveRequest, LeaveStatus };

export interface CreateLeaveRequestInput {
  schoolId: string;
  enrollmentId: string;
  parentId: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
}

export interface UpdateLeaveRequestInput {
  status?: LeaveStatus | undefined;
  decidedByStaffId?: string | null | undefined;
  decidedAt?: Date | null | undefined;
}

/** Persistence for `LeaveRequest` (ADR-003, ADR-011). No authorization/rules. */
export interface LeaveRequestRepository {
  findById(id: string): Promise<LeaveRequest | null>;
  listByEnrollment(enrollmentId: string): Promise<LeaveRequest[]>;
  /** Enrollment ids (from the given set) with an APPROVED leave covering `date` —
   *  the marking-time default lookup (ADR-011 §7). */
  approvedEnrollmentIdsOnDate(enrollmentIds: readonly string[], date: Date): Promise<string[]>;
  create(input: CreateLeaveRequestInput): Promise<LeaveRequest>;
  update(id: string, data: UpdateLeaveRequestInput): Promise<LeaveRequest>;
}

export function createLeaveRequestRepository(client: DbClient): LeaveRequestRepository {
  return {
    findById: (id) => client.leaveRequest.findUnique({ where: { id } }),
    listByEnrollment: (enrollmentId) =>
      client.leaveRequest.findMany({ where: { enrollmentId }, orderBy: { fromDate: "desc" } }),
    approvedEnrollmentIdsOnDate: async (enrollmentIds, date) => {
      if (enrollmentIds.length === 0) {
        return [];
      }
      const rows = await client.leaveRequest.findMany({
        where: {
          enrollmentId: { in: [...enrollmentIds] },
          status: "APPROVED",
          fromDate: { lte: date },
          toDate: { gte: date },
        },
        distinct: ["enrollmentId"],
        select: { enrollmentId: true },
      });
      return rows.map((r) => r.enrollmentId);
    },
    create: (input) => client.leaveRequest.create({ data: input }),
    update: (id, data) =>
      client.leaveRequest.update({
        where: { id },
        data: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.decidedByStaffId !== undefined
            ? { decidedByStaffId: data.decidedByStaffId }
            : {}),
          ...(data.decidedAt !== undefined ? { decidedAt: data.decidedAt } : {}),
        },
      }),
  };
}
