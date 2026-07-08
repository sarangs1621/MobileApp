import { PERMISSIONS } from "@repo/constants";
import { ConflictError, NotFoundError } from "@repo/core";
import type { Holiday } from "@repo/db";
import type { HolidayDto, HolidayTypeKey } from "@repo/types";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";

import { mapHoliday } from "./mappers";
import { recordAudit, toIstDateString } from "./scope";

export interface CreateHolidayInput {
  academicYearId: string;
  name: string;
  date: Date;
  type: HolidayTypeKey;
}

/** Add a holiday to a year's calendar. Writes ride ACADEMIC_MANAGE (ADR-011 §9,
 *  PERMISSIONS_MATRIX). One holiday per calendar day per year (DB unique). */
export async function createHoliday(
  ctx: ServiceContext,
  input: CreateHolidayInput,
): Promise<HolidayDto> {
  assertCan(ctx.user, PERMISSIONS.ACADEMIC_MANAGE);
  await assertYearInSchool(ctx, input.academicYearId);
  if (await ctx.repositories.holidays.findByYearDate(input.academicYearId, input.date)) {
    throw new ConflictError("A holiday already exists on that date");
  }

  return ctx.withTransaction(async (repos) => {
    const created = await repos.holidays.create({
      schoolId: ctx.user.schoolId,
      academicYearId: input.academicYearId,
      name: input.name,
      date: input.date,
      type: input.type,
    });
    await recordAudit(ctx, repos, {
      action: "HOLIDAY_CREATE",
      entityType: "Holiday",
      entityId: created.id,
      after: { name: created.name, date: toIstDateString(input.date), type: created.type },
    });
    return mapHoliday(created);
  });
}

/** Remove a holiday from the calendar. */
export async function deleteHoliday(ctx: ServiceContext, id: string): Promise<void> {
  assertCan(ctx.user, PERMISSIONS.ACADEMIC_MANAGE);
  const holiday = await loadHolidayInSchool(ctx, id);

  await ctx.withTransaction(async (repos) => {
    await repos.holidays.delete(holiday.id);
    await recordAudit(ctx, repos, {
      action: "HOLIDAY_DELETE",
      entityType: "Holiday",
      entityId: holiday.id,
      before: { name: holiday.name, type: holiday.type },
    });
  });
}

/** The holiday calendar of a year (readable by every in-scope role). */
export async function listHolidays(
  ctx: ServiceContext,
  academicYearId: string,
): Promise<HolidayDto[]> {
  assertCan(ctx.user, PERMISSIONS.HOLIDAY_READ);
  await assertYearInSchool(ctx, academicYearId);
  const rows = await ctx.repositories.holidays.listByYear(academicYearId);
  return rows.map(mapHoliday);
}

/* ---- internal ---- */

async function loadHolidayInSchool(ctx: ServiceContext, id: string): Promise<Holiday> {
  const row = await ctx.repositories.holidays.findById(id);
  if (!row || row.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Holiday not found");
  }
  return row;
}

async function assertYearInSchool(ctx: ServiceContext, id: string): Promise<void> {
  const year = await ctx.repositories.academicYears.findById(id);
  if (!year || year.schoolId !== ctx.user.schoolId) {
    throw new NotFoundError("Academic year not found");
  }
}
