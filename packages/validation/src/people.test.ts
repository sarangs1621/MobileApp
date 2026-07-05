import { describe, expect, it } from "vitest";

import {
  createParentInput,
  createStudentInput,
  enrollInput,
  mintDocumentUploadUrlInput,
  updateStudentInput,
} from "./index";

/** M3 people input schemas — shape/edge validation (rules live in services). */

describe("createStudentInput", () => {
  const base = { admissionNo: "ADM-001", firstName: "Asha", lastName: "Nair" };

  it("accepts a minimal identity and trims names", () => {
    const parsed = createStudentInput.parse({ ...base, firstName: "  Asha " });
    expect(parsed.firstName).toBe("Asha");
  });

  it("accepts a valid 12-digit Aadhaar", () => {
    expect(createStudentInput.parse({ ...base, aadhaar: "123456789012" }).aadhaar).toBe(
      "123456789012",
    );
  });

  it("rejects a malformed Aadhaar", () => {
    expect(() => createStudentInput.parse({ ...base, aadhaar: "12345" })).toThrow();
    expect(() => createStudentInput.parse({ ...base, aadhaar: "12345678901x" })).toThrow();
  });

  it("rejects an impossible calendar dob", () => {
    expect(() => createStudentInput.parse({ ...base, dob: "2015-02-30" })).toThrow();
  });
});

describe("updateStudentInput", () => {
  it("allows explicit nulls to clear optional identity fields", () => {
    const parsed = updateStudentInput.parse({ id: "st-1", dob: null, gender: null });
    expect(parsed.dob).toBeNull();
    expect(parsed.gender).toBeNull();
  });
});

describe("enrollInput", () => {
  const base = { studentId: "st-1", academicYearId: "y-1", classId: "c-1" };

  it("rejects zero / negative / fractional roll numbers", () => {
    expect(() => enrollInput.parse({ ...base, sectionId: "sec-1", rollNo: 0 })).toThrow();
    expect(() => enrollInput.parse({ ...base, sectionId: "sec-1", rollNo: -2 })).toThrow();
    expect(() => enrollInput.parse({ ...base, sectionId: "sec-1", rollNo: 1.5 })).toThrow();
  });

  it("accepts an unplaced enrollment (no section, no roll number)", () => {
    expect(enrollInput.parse(base)).toMatchObject(base);
  });
});

describe("createParentInput", () => {
  it("rejects an invalid email and a too-short phone", () => {
    expect(() => createParentInput.parse({ name: "P", phone: "123", email: "nope" })).toThrow();
    expect(() => createParentInput.parse({ name: "P", phone: "12" })).toThrow();
  });
});

describe("mintDocumentUploadUrlInput", () => {
  it("rejects an empty file name", () => {
    expect(() =>
      mintDocumentUploadUrlInput.parse({ studentId: "st-1", fileName: "   " }),
    ).toThrow();
  });
});
