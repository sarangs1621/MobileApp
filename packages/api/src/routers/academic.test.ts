import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behavior for the academic routers: route protection
 * (protectedProcedure), Zod input validation, and DomainError → tRPC code
 * mapping. Every case here fails BEFORE any repository/database call —
 * business-rule behavior (duplicates, overlaps, scoping) is unit-tested with
 * mocked repositories in @repo/business.
 */

const superAdmin: Principal = {
  userId: "u-super",
  schoolId: "s-1",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const invited: Principal = { ...parent, status: "INVITED" };
const disabled: Principal = { ...parent, status: "DISABLED" };

describe("academic routers — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = createCaller({ user: null });
    await expect(caller.academicYear.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an INVITED (not yet activated) account (FORBIDDEN)", async () => {
    const caller = createCaller({ user: invited });
    await expect(caller.academicYear.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    const caller = createCaller({ user: disabled });
    await expect(caller.class.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("academic routers — authorization (permission gate in the service)", () => {
  it("denies a PARENT reads across the academic surface (FORBIDDEN)", async () => {
    const caller = createCaller({ user: parent });
    await expect(caller.academicYear.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.subject.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.teacherAssignment.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a PARENT mutations (FORBIDDEN)", async () => {
    const caller = createCaller({ user: parent });
    await expect(
      caller.academicYear.create({
        name: "2027-28",
        startDate: "2027-06-01",
        endDate: "2028-03-31",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a TEACHER mutations (read-only role) (FORBIDDEN)", async () => {
    const caller = createCaller({ user: teacher });
    await expect(caller.subject.create({ name: "Physics" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.teacherAssignment.create({ teacherId: "u-x", subjectId: "s-x", sectionId: "sec-x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("academic routers — Zod input validation (BAD_REQUEST before any resolver)", () => {
  const caller = createCaller({ user: superAdmin });

  it("rejects a malformed date string", async () => {
    await expect(
      caller.academicYear.create({
        name: "2027-28",
        startDate: "01-06-2027",
        endDate: "2028-03-31",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an impossible calendar date (2027-02-30)", async () => {
    await expect(
      caller.academicYear.create({
        name: "2027-28",
        startDate: "2027-02-30",
        endDate: "2028-03-31",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an empty name", async () => {
    await expect(caller.subject.create({ name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects a non-integer class sortOrder", async () => {
    await expect(caller.class.create({ name: "Class 5", sortOrder: 1.5 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects a term create without its owning year id", async () => {
    await expect(
      // @ts-expect-error — deliberately missing academicYearId
      caller.academicTerm.create({
        name: "Term 1",
        startDate: "2026-06-01",
        endDate: "2026-10-31",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
