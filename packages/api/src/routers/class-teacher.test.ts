import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behaviour for the M6.5 classTeacher router (ADR-015): route
 * protection (protectedProcedure), permission gates that fail in the service
 * BEFORE any repository call (assertCan → Forbidden), and Zod input validation.
 * Assign/replace/remove business rules, in-place semantics, scope, and audit are
 * unit-tested in @repo/business (class-teacher.service).
 */

const superAdmin: Principal = {
  userId: "u-super",
  schoolId: "s-1",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};
const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };
const accountant: Principal = {
  userId: "u-acc",
  schoolId: "s-1",
  role: "ACCOUNTANT",
  status: "ACTIVE",
};
const disabled: Principal = { ...teacher, status: "DISABLED" };

const slot = { academicYearId: "y-1", sectionId: "sec-1", teacherId: "u-t2" };
const section = { academicYearId: "y-1", sectionId: "sec-1" };

describe("classTeacher router — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    await expect(createCaller({ user: null }).classTeacher.get(section)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    await expect(createCaller({ user: disabled }).classTeacher.get(section)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("classTeacher router — permission gates (fail in the service before any repo call)", () => {
  it("a TEACHER cannot assign (FORBIDDEN — holds academic:read but not academic:manage)", async () => {
    await expect(createCaller({ user: teacher }).classTeacher.assign(slot)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a TEACHER cannot replace (FORBIDDEN)", async () => {
    await expect(createCaller({ user: teacher }).classTeacher.replace(slot)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a TEACHER cannot remove (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: teacher }).classTeacher.remove({ id: "cta-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a PARENT cannot assign (FORBIDDEN)", async () => {
    await expect(createCaller({ user: parent }).classTeacher.assign(slot)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("a PARENT cannot read the class teacher (FORBIDDEN — no academic:read)", async () => {
    await expect(createCaller({ user: parent }).classTeacher.get(section)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("an ACCOUNTANT cannot read the class teacher (FORBIDDEN)", async () => {
    await expect(
      createCaller({ user: accountant }).classTeacher.get(section),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("classTeacher router — Zod input validation (BAD_REQUEST, before the resolver)", () => {
  const c = createCaller({ user: superAdmin });

  it("rejects an empty teacherId on assign", async () => {
    await expect(
      c.classTeacher.assign({ academicYearId: "y-1", sectionId: "sec-1", teacherId: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects a missing sectionId on get", async () => {
    // @ts-expect-error — the missing required field is the point of the test
    await expect(c.classTeacher.get({ academicYearId: "y-1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it("rejects an empty id on remove", async () => {
    await expect(c.classTeacher.remove({ id: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
