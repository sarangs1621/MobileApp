import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@repo/core";
import type {
  AcademicTerm,
  AcademicYear,
  Class,
  Repositories,
  Section,
  Subject,
  TeacherAssignment,
  User,
} from "@repo/db";
import { createNotificationService } from "@repo/notifications";
import { describe, expect, it, vi } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";

import { createAcademicTerm, updateAcademicTerm } from "./academic-term.service";
import {
  createAcademicYear,
  deleteAcademicYear,
  listAcademicYears,
  updateAcademicYear,
} from "./academic-year.service";
import { createClass, deleteClass, listClasses } from "./class.service";
import { createSection, deleteSection } from "./section.service";
import { createSubject, deleteSubject } from "./subject.service";
import {
  createTeacherAssignment,
  getTeacherAssignment,
  listTeacherAssignments,
} from "./teacher-assignment.service";

/* ---- fixtures ---- */

const superAdmin: Principal = {
  userId: "u-super",
  schoolId: "s-1",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};
const officeAdmin: Principal = {
  userId: "u-office",
  schoolId: "s-1",
  role: "OFFICE_ADMIN",
  status: "ACTIVE",
};
const teacher: Principal = {
  userId: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
};
const parent: Principal = { userId: "u-parent", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const stamps = { createdAt: d("2026-01-01"), updatedAt: d("2026-01-01") };

const yearRow: AcademicYear = {
  id: "y-1",
  schoolId: "s-1",
  name: "2026-27",
  startDate: d("2026-06-01"),
  endDate: d("2027-03-31"),
  status: "ACTIVE",
  ...stamps,
};
const termRow: AcademicTerm = {
  id: "t-1",
  academicYearId: "y-1",
  name: "Term 1",
  startDate: d("2026-06-01"),
  endDate: d("2026-10-31"),
  ...stamps,
};
const classRow: Class = { id: "c-1", schoolId: "s-1", name: "Class 5", sortOrder: 5, ...stamps };
const sectionRow: Section = { id: "sec-1", classId: "c-1", name: "A", ...stamps };
const subjectRow: Subject = { id: "sub-1", schoolId: "s-1", name: "Mathematics", ...stamps };
const assignmentRow: TeacherAssignment = {
  id: "a-1",
  schoolId: "s-1",
  teacherId: "u-teacher",
  subjectId: "sub-1",
  sectionId: "sec-1",
  ...stamps,
};
const teacherUser: User = {
  id: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
  phone: null,
  email: "t@school.example",
  locale: "EN",
  lastLoginAt: null,
  ...stamps,
};

/** Fully mocked, happy-path repository aggregate; tests override per case. */
function makeRepos() {
  return {
    users: {
      findById: vi.fn(async (): Promise<User | null> => teacherUser),
      create: vi.fn(),
      activate: vi.fn(),
      touchLastLogin: vi.fn(),
      setRole: vi.fn(),
      setStatus: vi.fn(),
      updateLocale: vi.fn(),
    },
    audit: { record: vi.fn(async (): Promise<void> => undefined) },
    academicYears: {
      list: vi.fn(async (): Promise<AcademicYear[]> => [yearRow]),
      findById: vi.fn(async (): Promise<AcademicYear | null> => yearRow),
      findByName: vi.fn(async (): Promise<AcademicYear | null> => null),
      findActive: vi.fn(async (): Promise<AcademicYear | null> => null),
      create: vi.fn(async (): Promise<AcademicYear> => yearRow),
      update: vi.fn(async (): Promise<AcademicYear> => yearRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
    academicTerms: {
      listByYear: vi.fn(async (): Promise<AcademicTerm[]> => [termRow]),
      findById: vi.fn(async (): Promise<AcademicTerm | null> => termRow),
      findByName: vi.fn(async (): Promise<AcademicTerm | null> => null),
      findOverlapping: vi.fn(async (): Promise<AcademicTerm | null> => null),
      create: vi.fn(async (): Promise<AcademicTerm> => termRow),
      update: vi.fn(async (): Promise<AcademicTerm> => termRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
    classes: {
      list: vi.fn(async (): Promise<Class[]> => [classRow]),
      findById: vi.fn(async (): Promise<Class | null> => classRow),
      findByName: vi.fn(async (): Promise<Class | null> => null),
      hasSections: vi.fn(async (): Promise<boolean> => false),
      create: vi.fn(async (): Promise<Class> => classRow),
      update: vi.fn(async (): Promise<Class> => classRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
    sections: {
      listByClass: vi.fn(async (): Promise<Section[]> => [sectionRow]),
      findById: vi.fn(async (): Promise<Section | null> => sectionRow),
      findByName: vi.fn(async (): Promise<Section | null> => null),
      hasAssignments: vi.fn(async (): Promise<boolean> => false),
      create: vi.fn(async (): Promise<Section> => sectionRow),
      update: vi.fn(async (): Promise<Section> => sectionRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
    subjects: {
      list: vi.fn(async (): Promise<Subject[]> => [subjectRow]),
      findById: vi.fn(async (): Promise<Subject | null> => subjectRow),
      findByName: vi.fn(async (): Promise<Subject | null> => null),
      hasAssignments: vi.fn(async (): Promise<boolean> => false),
      create: vi.fn(async (): Promise<Subject> => subjectRow),
      update: vi.fn(async (): Promise<Subject> => subjectRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
    teacherAssignments: {
      list: vi.fn(async (): Promise<TeacherAssignment[]> => [assignmentRow]),
      findById: vi.fn(async (): Promise<TeacherAssignment | null> => assignmentRow),
      findByTriple: vi.fn(async (): Promise<TeacherAssignment | null> => null),
      create: vi.fn(async (): Promise<TeacherAssignment> => assignmentRow),
      delete: vi.fn(async (): Promise<void> => undefined),
    },
  };
}

function makeCtx(user: Principal, repos = makeRepos()) {
  const repositories = repos as unknown as Repositories;
  const ctx: ServiceContext = {
    user,
    repositories,
    notifications: createNotificationService([]),
    withTransaction: <T>(fn: (r: Repositories) => Promise<T>) => fn(repositories),
  };
  return { ctx, repos };
}

const validYear = { name: "2027-28", startDate: d("2027-06-01"), endDate: d("2028-03-31") };

/* ---- academic year ---- */

describe("academic year — business rules", () => {
  it("creates a year (OFFICE_ADMIN), maps @db.Date → IST strings, audits in-tx", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.academicYears.create.mockResolvedValueOnce({
      ...yearRow,
      id: "y-2",
      ...validYear,
      status: "PLANNED",
    });
    const dto = await createAcademicYear(ctx, validYear);
    expect(dto).toMatchObject({ id: "y-2", startDate: "2027-06-01", endDate: "2028-03-31" });
    expect(repos.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACADEMIC_YEAR_CREATE", entityType: "AcademicYear" }),
    );
  });

  it("rejects a duplicate name in the school (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.academicYears.findByName.mockResolvedValueOnce(yearRow);
    await expect(createAcademicYear(ctx, { ...validYear, name: "2026-27" })).rejects.toThrow(
      ConflictError,
    );
    expect(repos.academicYears.create).not.toHaveBeenCalled();
  });

  it("rejects a second ACTIVE year (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.academicYears.findActive.mockResolvedValueOnce(yearRow);
    await expect(createAcademicYear(ctx, { ...validYear, status: "ACTIVE" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("rejects startDate ≥ endDate (ValidationError)", async () => {
    const { ctx } = makeCtx(superAdmin);
    await expect(
      createAcademicYear(ctx, { ...validYear, startDate: d("2028-04-01") }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects activating a year while another is ACTIVE (update)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.academicYears.findById.mockResolvedValueOnce({
      ...yearRow,
      id: "y-2",
      status: "PLANNED",
    });
    repos.academicYears.findActive.mockResolvedValueOnce(yearRow);
    await expect(updateAcademicYear(ctx, "y-2", { status: "ACTIVE" })).rejects.toThrow(
      ConflictError,
    );
  });

  it("hides a year from another school (NotFoundError, not Forbidden — no tenant leak)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.academicYears.findById.mockResolvedValueOnce({ ...yearRow, schoolId: "s-other" });
    await expect(updateAcademicYear(ctx, "y-1", { name: "x" })).rejects.toThrow(NotFoundError);
  });

  it("audits deletes with the before image", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    await deleteAcademicYear(ctx, "y-1");
    expect(repos.academicYears.delete).toHaveBeenCalledWith("y-1");
    expect(repos.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACADEMIC_YEAR_DELETE" }),
    );
  });

  it("lets a TEACHER read but not create (read-only role)", async () => {
    const read = makeCtx(teacher);
    await expect(listAcademicYears(read.ctx)).resolves.toHaveLength(1);
    const write = makeCtx(teacher);
    await expect(createAcademicYear(write.ctx, validYear)).rejects.toThrow(ForbiddenError);
    expect(write.repos.academicYears.create).not.toHaveBeenCalled();
  });

  it("denies a PARENT even reads (no academic surface)", async () => {
    const { ctx } = makeCtx(parent);
    await expect(listAcademicYears(ctx)).rejects.toThrow(ForbiddenError);
  });
});

/* ---- academic term ---- */

describe("academic term — business rules", () => {
  const validTerm = {
    academicYearId: "y-1",
    name: "Term 2",
    startDate: d("2026-11-01"),
    endDate: d("2027-03-31"),
  };

  it("rejects overlapping term dates in the same year (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.academicTerms.findOverlapping.mockResolvedValueOnce(termRow);
    await expect(createAcademicTerm(ctx, validTerm)).rejects.toThrow(ConflictError);
    expect(repos.academicTerms.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate term name within the year (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.academicTerms.findByName.mockResolvedValueOnce(termRow);
    await expect(createAcademicTerm(ctx, validTerm)).rejects.toThrow(ConflictError);
  });

  it("rejects invalid dates (start ≥ end)", async () => {
    const { ctx } = makeCtx(officeAdmin);
    await expect(
      createAcademicTerm(ctx, { ...validTerm, endDate: d("2026-11-01") }),
    ).rejects.toThrow(ValidationError);
  });

  it("re-checks overlap when update shifts dates (excluding itself)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.academicTerms.findOverlapping.mockResolvedValueOnce({ ...termRow, id: "t-2" });
    await expect(updateAcademicTerm(ctx, "t-1", { endDate: d("2026-12-15") })).rejects.toThrow(
      ConflictError,
    );
    expect(repos.academicTerms.findOverlapping).toHaveBeenCalledWith(
      "y-1",
      termRow.startDate,
      d("2026-12-15"),
      "t-1",
    );
  });

  it("refuses terms under a year of another school (NotFoundError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.academicYears.findById.mockResolvedValueOnce({ ...yearRow, schoolId: "s-other" });
    await expect(createAcademicTerm(ctx, validTerm)).rejects.toThrow(NotFoundError);
  });
});

/* ---- class / section / subject ---- */

describe("class — business rules", () => {
  it("rejects a duplicate class name in the school (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.classes.findByName.mockResolvedValueOnce(classRow);
    await expect(createClass(ctx, { name: "Class 5" })).rejects.toThrow(ConflictError);
  });

  it("blocks deleting a class that still has sections (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.classes.hasSections.mockResolvedValueOnce(true);
    await expect(deleteClass(ctx, "c-1")).rejects.toThrow(ConflictError);
    expect(repos.classes.delete).not.toHaveBeenCalled();
  });

  it("lets a TEACHER list classes (read grant)", async () => {
    const { ctx } = makeCtx(teacher);
    await expect(listClasses(ctx)).resolves.toHaveLength(1);
  });
});

describe("section — business rules", () => {
  it("rejects a duplicate section name within the class (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.sections.findByName.mockResolvedValueOnce(sectionRow);
    await expect(createSection(ctx, { classId: "c-1", name: "A" })).rejects.toThrow(ConflictError);
  });

  it("blocks deleting a section with teacher assignments (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.sections.hasAssignments.mockResolvedValueOnce(true);
    await expect(deleteSection(ctx, "sec-1")).rejects.toThrow(ConflictError);
    expect(repos.sections.delete).not.toHaveBeenCalled();
  });
});

describe("subject — business rules", () => {
  it("rejects a duplicate subject name in the school (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.subjects.findByName.mockResolvedValueOnce(subjectRow);
    await expect(createSubject(ctx, { name: "Mathematics" })).rejects.toThrow(ConflictError);
  });

  it("blocks deleting a subject with teacher assignments (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(superAdmin);
    repos.subjects.hasAssignments.mockResolvedValueOnce(true);
    await expect(deleteSubject(ctx, "sub-1")).rejects.toThrow(ConflictError);
  });
});

/* ---- teacher assignment ---- */

describe("teacher assignment — business rules", () => {
  const input = { teacherId: "u-teacher", subjectId: "sub-1", sectionId: "sec-1" };

  it("creates an assignment and audits it", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    const dto = await createTeacherAssignment(ctx, input);
    expect(dto).toMatchObject(input);
    expect(repos.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TEACHER_ASSIGNMENT_CREATE" }),
    );
  });

  it("rejects a duplicate (teacher, subject, section) triple (ConflictError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.teacherAssignments.findByTriple.mockResolvedValueOnce(assignmentRow);
    await expect(createTeacherAssignment(ctx, input)).rejects.toThrow(ConflictError);
    expect(repos.teacherAssignments.create).not.toHaveBeenCalled();
  });

  it("rejects an assignee who is not a TEACHER (ValidationError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.users.findById.mockResolvedValueOnce({ ...teacherUser, role: "PARENT" });
    await expect(createTeacherAssignment(ctx, input)).rejects.toThrow(ValidationError);
  });

  it("rejects an assignee who is not ACTIVE (ValidationError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.users.findById.mockResolvedValueOnce({ ...teacherUser, status: "DISABLED" });
    await expect(createTeacherAssignment(ctx, input)).rejects.toThrow(ValidationError);
  });

  it("rejects an assignee from another school (NotFoundError)", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    repos.users.findById.mockResolvedValueOnce({ ...teacherUser, schoolId: "s-other" });
    await expect(createTeacherAssignment(ctx, input)).rejects.toThrow(NotFoundError);
  });

  it("scopes a TEACHER's list to their own rows even with a foreign filter", async () => {
    const { ctx, repos } = makeCtx(teacher);
    await listTeacherAssignments(ctx, { teacherId: "u-someone-else" });
    expect(repos.teacherAssignments.list).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({ teacherId: "u-teacher" }),
    );
  });

  it("admins may filter by any teacher", async () => {
    const { ctx, repos } = makeCtx(officeAdmin);
    await listTeacherAssignments(ctx, { teacherId: "u-any" });
    expect(repos.teacherAssignments.list).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({ teacherId: "u-any" }),
    );
  });

  it("blocks a TEACHER from reading another teacher's assignment (ForbiddenError)", async () => {
    const { ctx, repos } = makeCtx(teacher);
    repos.teacherAssignments.findById.mockResolvedValueOnce({
      ...assignmentRow,
      teacherId: "u-other",
    });
    await expect(getTeacherAssignment(ctx, "a-1")).rejects.toThrow(ForbiddenError);
  });

  it("blocks a TEACHER from creating assignments (ForbiddenError)", async () => {
    const { ctx } = makeCtx(teacher);
    await expect(createTeacherAssignment(ctx, input)).rejects.toThrow(ForbiddenError);
  });
});
