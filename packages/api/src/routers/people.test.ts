import type { Principal } from "@repo/business";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

/**
 * Transport-layer behavior for the people routers: route protection
 * (protectedProcedure), permission gates (fail in the service BEFORE any
 * repository call), Zod input validation, and the storage-wiring gate. Row
 * scoping and business rules are unit-tested with mocked repositories in
 * @repo/business.
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

describe("people routers — route protection", () => {
  it("rejects an unauthenticated caller (UNAUTHORIZED)", async () => {
    const caller = createCaller({ user: null });
    await expect(caller.student.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an INVITED (not yet activated) account (FORBIDDEN)", async () => {
    const caller = createCaller({ user: invited });
    await expect(caller.student.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a DISABLED account (FORBIDDEN)", async () => {
    const caller = createCaller({ user: disabled });
    await expect(caller.parent.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("people routers — permission gates (mapped to FORBIDDEN)", () => {
  it("denies a PARENT student/parent mutations (read-only role)", async () => {
    const caller = createCaller({ user: parent });
    await expect(
      caller.student.create({ admissionNo: "ADM-9", firstName: "A", lastName: "B" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.parent.link({ studentId: "st-1", parentId: "p-1", relationship: "FATHER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a PARENT the teacher-profile surface (no STAFF_READ)", async () => {
    const caller = createCaller({ user: parent });
    await expect(caller.teacherProfile.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a TEACHER the parents list (no PARENT_READ)", async () => {
    const caller = createCaller({ user: teacher });
    await expect(caller.parent.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies a TEACHER enrollment mutations", async () => {
    const caller = createCaller({ user: teacher });
    await expect(
      caller.enrollment.create({ studentId: "st-1", academicYearId: "y-1", classId: "c-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.enrollment.withdraw({ enrollmentId: "e-1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("denies a TEACHER document mutations (read-only, PHOTO-scoped role)", async () => {
    const caller = createCaller({ user: teacher });
    await expect(
      caller.studentDocument.upload({
        studentId: "st-1",
        type: "PHOTO",
        storagePath: "s-1/st-1/x.jpg",
        fileName: "x.jpg",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("people routers — Zod input validation (BAD_REQUEST before any resolver)", () => {
  const caller = createCaller({ user: superAdmin });

  it("rejects a malformed Aadhaar (not 12 digits)", async () => {
    await expect(
      caller.student.create({
        admissionNo: "ADM-9",
        firstName: "A",
        lastName: "B",
        aadhaar: "123",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an impossible date of birth (2015-02-30)", async () => {
    await expect(
      caller.student.create({
        admissionNo: "ADM-9",
        firstName: "A",
        lastName: "B",
        dob: "2015-02-30",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an empty (whitespace) name", async () => {
    await expect(
      caller.student.create({ admissionNo: "ADM-9", firstName: "   ", lastName: "B" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a non-positive roll number", async () => {
    await expect(
      caller.enrollment.create({
        studentId: "st-1",
        academicYearId: "y-1",
        classId: "c-1",
        sectionId: "sec-1",
        rollNo: 0,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an invalid parent email", async () => {
    await expect(
      caller.parent.create({ name: "P", phone: "12345", email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("people routers — storage wiring gate", () => {
  it("upload/download URL minting without a host StoragePort is PRECONDITION_FAILED", async () => {
    const caller = createCaller({ user: superAdmin });
    await expect(
      caller.studentDocument.uploadUrl({ studentId: "st-1", fileName: "x.jpg" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.studentDocument.downloadUrl({ id: "doc-1" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
