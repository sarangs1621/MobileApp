import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@repo/constants";
import { describe, expect, it } from "vitest";

import {
  createAcademicYearInput,
  createSectionInput,
  createTeacherAssignmentInput,
  cursorPaginationInput,
  idSchema,
  istDateSchema,
  setRoleInput,
  sortDirSchema,
  updateProfileInput,
  updateSubjectInput,
  userIdInput,
} from "./index";

describe("auth input schemas (edge cases)", () => {
  it("updateProfileInput accepts each supported locale and rejects anything else", () => {
    expect(updateProfileInput.parse({ locale: "en" })).toEqual({ locale: "en" });
    expect(updateProfileInput.parse({ locale: "ml" })).toEqual({ locale: "ml" });
    expect(updateProfileInput.safeParse({ locale: "hi" }).success).toBe(false);
    expect(updateProfileInput.safeParse({ locale: "EN" }).success).toBe(false); // DB casing is not a UI locale
    expect(updateProfileInput.safeParse({}).success).toBe(false);
  });

  it("setRoleInput rejects roles outside the fixed set (no STUDENT role — students are records)", () => {
    expect(setRoleInput.parse({ userId: "u-1", role: "TEACHER" })).toEqual({
      userId: "u-1",
      role: "TEACHER",
    });
    expect(setRoleInput.safeParse({ userId: "u-1", role: "STUDENT" }).success).toBe(false);
    expect(setRoleInput.safeParse({ userId: "u-1", role: "teacher" }).success).toBe(false);
    expect(setRoleInput.safeParse({ userId: "", role: "TEACHER" }).success).toBe(false);
  });

  it("userIdInput requires a non-empty id", () => {
    expect(userIdInput.parse({ userId: "u-1" })).toEqual({ userId: "u-1" });
    expect(userIdInput.safeParse({ userId: "" }).success).toBe(false);
    expect(userIdInput.safeParse({}).success).toBe(false);
  });

  it("idSchema rejects the empty string and non-strings", () => {
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse(123).success).toBe(false);
    expect(idSchema.parse("ckx0000")).toBe("ckx0000");
  });
});

describe("pagination & sorting primitives", () => {
  it("cursorPaginationInput applies the default limit and caps at MAX_PAGE_SIZE", () => {
    expect(cursorPaginationInput.parse({})).toEqual({ limit: DEFAULT_PAGE_SIZE });
    expect(cursorPaginationInput.parse({ limit: MAX_PAGE_SIZE }).limit).toBe(MAX_PAGE_SIZE);
    expect(cursorPaginationInput.safeParse({ limit: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(cursorPaginationInput.safeParse({ limit: 0 }).success).toBe(false);
    expect(cursorPaginationInput.safeParse({ limit: 1.5 }).success).toBe(false);
  });

  it("sortDirSchema defaults to asc and rejects unknown directions", () => {
    expect(sortDirSchema.parse(undefined)).toBe("asc");
    expect(sortDirSchema.parse("desc")).toBe("desc");
    expect(sortDirSchema.safeParse("descending").success).toBe(false);
  });
});

describe("academic input schemas (M2 edge cases)", () => {
  it("istDateSchema parses YYYY-MM-DD to a UTC-midnight Date", () => {
    expect(istDateSchema.parse("2026-06-01")).toEqual(new Date("2026-06-01T00:00:00.000Z"));
  });

  it("istDateSchema rejects malformed and impossible calendar dates", () => {
    expect(istDateSchema.safeParse("01-06-2026").success).toBe(false); // wrong order
    expect(istDateSchema.safeParse("2026-6-1").success).toBe(false); // not zero-padded
    expect(istDateSchema.safeParse("2026-13-01").success).toBe(false); // month 13
    expect(istDateSchema.safeParse("2026-02-30").success).toBe(false); // rolls over
    expect(istDateSchema.safeParse("2026-06-01T00:00:00Z").success).toBe(false); // timestamp
  });

  it("createAcademicYearInput trims the name and keeps status optional", () => {
    const parsed = createAcademicYearInput.parse({
      name: "  2026-27  ",
      startDate: "2026-06-01",
      endDate: "2027-03-31",
    });
    expect(parsed.name).toBe("2026-27");
    expect(parsed.status).toBeUndefined();
    expect(
      createAcademicYearInput.safeParse({
        name: "2026-27",
        startDate: "2026-06-01",
        endDate: "2027-03-31",
        status: "OPEN",
      }).success,
    ).toBe(false);
  });

  it("name fields reject empty/whitespace-only and overlong values", () => {
    expect(createSectionInput.safeParse({ classId: "c-1", name: "   " }).success).toBe(false);
    expect(updateSubjectInput.safeParse({ id: "s-1", name: "x".repeat(121) }).success).toBe(false);
  });

  it("createTeacherAssignmentInput requires all three references", () => {
    expect(createTeacherAssignmentInput.safeParse({ teacherId: "t", subjectId: "s" }).success).toBe(
      false,
    );
    expect(
      createTeacherAssignmentInput.parse({ teacherId: "t", subjectId: "s", sectionId: "x" }),
    ).toEqual({ teacherId: "t", subjectId: "s", sectionId: "x" });
  });
});
