import type {
  BehaviourCategory,
  BehaviourIncident,
  BehaviourSeverity,
  BehaviourStatus,
  Prisma,
} from "@prisma/client";

import type { DbClient } from "../db-client";

export type { BehaviourCategory, BehaviourIncident, BehaviourSeverity, BehaviourStatus };

export interface CreateBehaviourIncidentInput {
  schoolId: string;
  academicYearId: string;
  studentId: string;
  enrollmentId: string;
  teacherId: string;
  category: BehaviourCategory;
  severity: BehaviourSeverity;
  title: string;
  description: string;
  actionTaken?: string | null;
  createdByStaffId: string;
}

export interface UpdateBehaviourIncidentInput {
  category?: BehaviourCategory;
  severity?: BehaviourSeverity;
  title?: string;
  description?: string;
  actionTaken?: string | null;
  status?: BehaviourStatus;
  resolvedByStaffId?: string | null;
  resolvedAt?: Date | null;
}

/** Filters for the admin console + the student/teacher wrappers (ADR-020 §6). */
export interface ListBehaviourIncidentsFilter {
  studentId?: string;
  teacherId?: string;
  status?: BehaviourStatus;
  severity?: BehaviourSeverity;
  limit: number;
  /** Keyset cursor — rows strictly older than this createdAt. */
  before?: Date;
}

/**
 * Persistence for `BehaviourIncident` (ADR-003, ADR-020). No authorization: the
 * business layer resolves permission, scope, and the lifecycle transition graph
 * (only resolve/close reach the stamped RESOLVED/CLOSED states — the DB CHECK).
 */
export interface BehaviourIncidentRepository {
  create(input: CreateBehaviourIncidentInput): Promise<BehaviourIncident>;
  findById(id: string): Promise<BehaviourIncident | null>;
  list(schoolId: string, filter: ListBehaviourIncidentsFilter): Promise<BehaviourIncident[]>;
  update(id: string, input: UpdateBehaviourIncidentInput): Promise<BehaviourIncident>;
  /** Set parentNotified (post-commit best-effort flag; ADR-020 §3). */
  setParentNotified(id: string, value: boolean): Promise<BehaviourIncident>;
}

export function createBehaviourIncidentRepository(client: DbClient): BehaviourIncidentRepository {
  return {
    create: (input) =>
      client.behaviourIncident.create({
        data: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          studentId: input.studentId,
          enrollmentId: input.enrollmentId,
          teacherId: input.teacherId,
          category: input.category,
          severity: input.severity,
          title: input.title,
          description: input.description,
          actionTaken: input.actionTaken ?? null,
          createdByStaffId: input.createdByStaffId,
        },
      }),

    findById: (id) => client.behaviourIncident.findUnique({ where: { id } }),

    list: (schoolId, filter) => {
      const where: Prisma.BehaviourIncidentWhereInput = { schoolId };
      if (filter.studentId) {
        where.studentId = filter.studentId;
      }
      if (filter.teacherId) {
        where.teacherId = filter.teacherId;
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.severity) {
        where.severity = filter.severity;
      }
      if (filter.before) {
        where.createdAt = { lt: filter.before };
      }
      return client.behaviourIncident.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
      });
    },

    update: (id, input) =>
      client.behaviourIncident.update({
        where: { id },
        data: {
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.severity !== undefined ? { severity: input.severity } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.actionTaken !== undefined ? { actionTaken: input.actionTaken } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.resolvedByStaffId !== undefined
            ? { resolvedByStaffId: input.resolvedByStaffId }
            : {}),
          ...(input.resolvedAt !== undefined ? { resolvedAt: input.resolvedAt } : {}),
        },
      }),

    setParentNotified: (id, value) =>
      client.behaviourIncident.update({ where: { id }, data: { parentNotified: value } }),
  };
}
