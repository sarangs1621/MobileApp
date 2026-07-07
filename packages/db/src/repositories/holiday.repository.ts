import type { Holiday, HolidayType } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { Holiday, HolidayType };

export interface CreateHolidayInput {
  schoolId: string;
  academicYearId: string;
  name: string;
  date: Date;
  type: HolidayType;
}

/** Persistence for `Holiday` (ADR-003, ADR-011). No authorization/rules. */
export interface HolidayRepository {
  findById(id: string): Promise<Holiday | null>;
  listByYear(academicYearId: string): Promise<Holiday[]>;
  /** The holiday on a given calendar day of a year, if any (working-day resolution). */
  findByYearDate(academicYearId: string, date: Date): Promise<Holiday | null>;
  create(input: CreateHolidayInput): Promise<Holiday>;
  delete(id: string): Promise<void>;
}

export function createHolidayRepository(client: DbClient): HolidayRepository {
  return {
    findById: (id) => client.holiday.findUnique({ where: { id } }),
    listByYear: (academicYearId) =>
      client.holiday.findMany({ where: { academicYearId }, orderBy: { date: "asc" } }),
    findByYearDate: (academicYearId, date) =>
      client.holiday.findUnique({ where: { academicYearId_date: { academicYearId, date } } }),
    create: (input) => client.holiday.create({ data: input }),
    delete: async (id) => {
      await client.holiday.delete({ where: { id } });
    },
  };
}
