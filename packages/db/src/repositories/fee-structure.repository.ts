import type { FeeComponent, FeeStructure, Prisma } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { FeeComponent, FeeStructure };
export type FeeStructureWithComponents = FeeStructure & { components: FeeComponent[] };

export interface FeeComponentInput {
  name: string;
  amount: number; // paise
  order: number;
  mandatory: boolean;
}

export interface CreateFeeStructureInput {
  schoolId: string;
  academicYearId: string;
  name: string;
  description?: string | null;
  components: FeeComponentInput[];
}

export interface UpdateFeeStructureInput {
  name?: string;
  description?: string | null;
  active?: boolean;
  /** When present, the component set is REPLACED wholesale (ADR-021 §2 — only future
   *  invoices are affected; issued invoices keep their snapshotted total). */
  components?: FeeComponentInput[];
}

export interface ListFeeStructuresFilter {
  academicYearId?: string;
  active?: boolean;
}

/** Persistence for `FeeStructure` + its `FeeComponent` lines (ADR-003, ADR-021). No authorization. */
export interface FeeStructureRepository {
  create(input: CreateFeeStructureInput): Promise<FeeStructureWithComponents>;
  findById(id: string): Promise<FeeStructureWithComponents | null>;
  list(schoolId: string, filter: ListFeeStructuresFilter): Promise<FeeStructureWithComponents[]>;
  update(id: string, input: UpdateFeeStructureInput): Promise<FeeStructureWithComponents>;
}

const componentsOrdered = { orderBy: { order: "asc" } } as const;

export function createFeeStructureRepository(client: DbClient): FeeStructureRepository {
  return {
    create: (input) =>
      client.feeStructure.create({
        data: {
          schoolId: input.schoolId,
          academicYearId: input.academicYearId,
          name: input.name,
          description: input.description ?? null,
          components: { create: input.components },
        },
        include: { components: componentsOrdered },
      }),

    findById: (id) =>
      client.feeStructure.findUnique({
        where: { id },
        include: { components: componentsOrdered },
      }),

    list: (schoolId, filter) => {
      const where: Prisma.FeeStructureWhereInput = { schoolId };
      if (filter.academicYearId) {
        where.academicYearId = filter.academicYearId;
      }
      if (filter.active !== undefined) {
        where.active = filter.active;
      }
      return client.feeStructure.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { components: componentsOrdered },
      });
    },

    update: (id, input) =>
      client.feeStructure.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          // Replace-all: drop the old lines and recreate (only future invoices affected).
          ...(input.components !== undefined
            ? { components: { deleteMany: {}, create: input.components } }
            : {}),
        },
        include: { components: componentsOrdered },
      }),
  };
}
