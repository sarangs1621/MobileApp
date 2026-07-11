import { ConflictError, ForbiddenError, ValidationError } from "@repo/core";
import type {
  AcademicYear,
  BehaviourIncident,
  Enrollment,
  Notification,
  Parent,
  Repositories,
  Staff,
  Student,
  StudentParent,
  TeacherAssignment,
  User,
} from "@repo/db";
import { createNotificationService } from "@repo/notifications";
import type { LeaveRequestDto } from "@repo/types";
import { describe, expect, it, vi } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";
import { emitLeaveDecided } from "../notification";

import {
  closeBehaviourIncident,
  createBehaviourIncident,
  listBehaviourByStudent,
  resolveBehaviourIncident,
  updateBehaviourIncident,
} from "./behaviour.service";

/* ---- principals ---- */
const admin: Principal = {
  userId: "u-admin",
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

/* ---- fixtures ---- */
const d = new Date("2026-01-02T00:00:00.000Z");
const stamps = { createdAt: d, updatedAt: d };

const incident = (over: Partial<BehaviourIncident> = {}): BehaviourIncident => ({
  id: "b-1",
  schoolId: "s-1",
  academicYearId: "y-1",
  studentId: "st-1",
  enrollmentId: "e-1",
  teacherId: "u-teacher",
  category: "DISCIPLINE",
  severity: "LOW",
  title: "Talking in class",
  description: "Disruptive",
  actionTaken: null,
  status: "OPEN",
  parentNotified: false,
  createdByStaffId: "stf-1",
  resolvedByStaffId: null,
  resolvedAt: null,
  ...stamps,
  ...over,
});

const student: Student = {
  id: "st-1",
  schoolId: "s-1",
  admissionNo: "A1",
  firstName: "Kid",
  lastName: "One",
  dob: null,
  gender: null,
  bloodGroup: null,
  nationality: null,
  aadhaar: null,
  passport: null,
  address: null,
  photoPath: null,
  status: "ACTIVE",
  ...stamps,
};
const enrollment: Enrollment = {
  id: "e-1",
  schoolId: "s-1",
  studentId: "st-1",
  academicYearId: "y-1",
  classId: "c-1",
  sectionId: "sec-a",
  rollNo: 1,
  status: "ACTIVE",
  ...stamps,
};
const teacherUser: User = {
  id: "u-teacher",
  schoolId: "s-1",
  role: "TEACHER",
  status: "ACTIVE",
  phone: null,
  email: null,
  locale: "EN",
  lastLoginAt: null,
  ...stamps,
};
const parentRow: Parent = {
  id: "par-1",
  schoolId: "s-1",
  userId: "u-parent",
  name: "Mom",
  phone: "9",
  email: null,
  occupation: null,
  address: null,
  preferredContact: "PHONE",
  ...stamps,
};
const assignment: TeacherAssignment = {
  id: "ta-1",
  schoolId: "s-1",
  teacherId: "u-teacher",
  subjectId: "subj-1",
  sectionId: "sec-a",
  createdAt: d,
};

function makeRepos(current: BehaviourIncident = incident(), studentInScope = true) {
  return {
    audit: { record: vi.fn(async (): Promise<void> => undefined) },
    behaviourIncidents: {
      create: vi.fn(async (input: Record<string, unknown>): Promise<BehaviourIncident> =>
        incident(input as Partial<BehaviourIncident>),
      ),
      findById: vi.fn(async (): Promise<BehaviourIncident | null> => current),
      list: vi.fn(async (): Promise<BehaviourIncident[]> => [current]),
      update: vi.fn(
        async (_id: string, input: Partial<BehaviourIncident>): Promise<BehaviourIncident> =>
          incident({ ...current, ...input }),
      ),
      setParentNotified: vi.fn(async (_id: string, value: boolean): Promise<BehaviourIncident> =>
        incident({ ...current, parentNotified: value }),
      ),
    },
    students: { findById: vi.fn(async (): Promise<Student | null> => student) },
    enrollments: {
      findById: vi.fn(async (): Promise<Enrollment | null> => enrollment),
      findByStudentYear: vi.fn(async (): Promise<Enrollment | null> => enrollment),
      studentIdsInSections: vi.fn(async (): Promise<string[]> => (studentInScope ? ["st-1"] : [])),
    },
    teacherAssignments: { list: vi.fn(async (): Promise<TeacherAssignment[]> => [assignment]) },
    academicYears: {
      findActive: vi.fn(async (): Promise<AcademicYear | null> => ({ id: "y-1" }) as AcademicYear),
    },
    staff: { findByUserId: vi.fn(async (): Promise<Staff | null> => ({ id: "stf-1" }) as Staff) },
    parents: {
      findByUserId: vi.fn(async (): Promise<Parent | null> =>
        studentInScope ? parentRow : parentRow,
      ),
      findById: vi.fn(async (): Promise<Parent | null> => parentRow),
    },
    studentParents: {
      listByStudent: vi.fn(async (): Promise<StudentParent[]> => [
        {
          studentId: "st-1",
          parentId: "par-1",
          relationship: "MOTHER",
          isPrimary: true,
          createdAt: d,
        },
      ]),
      studentIdsForParent: vi.fn(async (): Promise<string[]> => ["st-1"]),
    },
    users: {
      findById: vi.fn(async (id: string): Promise<User | null> =>
        id === "u-teacher" ? teacherUser : null,
      ),
    },
    notifications: {
      create: vi.fn(async (): Promise<Notification> => ({ id: "n-1" }) as Notification),
    },
    notificationRecipients: {
      createMany: vi.fn(async (_id: string, userIds: string[]): Promise<number> => userIds.length),
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

const baseInput = {
  studentId: "st-1",
  category: "DISCIPLINE" as const,
  severity: "LOW" as const,
  title: "Talking",
  description: "Disruptive",
};

describe("createBehaviourIncident — authorship", () => {
  it("teacher: teacherId is server-set to self (a client-supplied teacherId is ignored)", async () => {
    const { ctx, repos } = makeCtx(teacher);
    await createBehaviourIncident(ctx, { ...baseInput, teacherId: "u-someone-else" });
    expect(repos.behaviourIncidents.create).toHaveBeenCalledWith(
      expect.objectContaining({ teacherId: "u-teacher", enrollmentId: "e-1" }),
    );
  });

  it("teacher: a student outside their sections is refused", async () => {
    const { ctx } = makeCtx(teacher, makeRepos(incident(), /* studentInScope */ false));
    await expect(createBehaviourIncident(ctx, baseInput)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admin: must name a valid referring teacher", async () => {
    const { ctx } = makeCtx(admin);
    await expect(createBehaviourIncident(ctx, baseInput)).rejects.toBeInstanceOf(ValidationError);
    const ok = makeCtx(admin);
    await createBehaviourIncident(ok.ctx, { ...baseInput, teacherId: "u-teacher" });
    expect(ok.repos.behaviourIncidents.create).toHaveBeenCalledWith(
      expect.objectContaining({ teacherId: "u-teacher" }),
    );
  });

  it("parent: cannot record an incident", async () => {
    const { ctx } = makeCtx(parent);
    await expect(createBehaviourIncident(ctx, baseInput)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("createBehaviourIncident — notification integration", () => {
  it("notifies the student's parents (type BEHAVIOUR) and flips parentNotified when reached", async () => {
    const { ctx, repos } = makeCtx(teacher);
    const result = await createBehaviourIncident(ctx, baseInput);
    expect(repos.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "BEHAVIOUR" }),
    );
    expect(repos.notificationRecipients.createMany).toHaveBeenCalledWith("n-1", ["u-parent"]);
    expect(repos.behaviourIncidents.setParentNotified).toHaveBeenCalledWith("b-1", true);
    expect(result.parentNotified).toBe(true);
  });

  it("does not flip parentNotified when there are no reachable parents", async () => {
    const repos = makeRepos();
    repos.studentParents.listByStudent = vi.fn(async () => []);
    const { ctx } = makeCtx(teacher, repos);
    const result = await createBehaviourIncident(ctx, baseInput);
    expect(repos.behaviourIncidents.setParentNotified).not.toHaveBeenCalled();
    expect(result.parentNotified).toBe(false);
  });

  it("notify=false suppresses the fan-out", async () => {
    const { ctx, repos } = makeCtx(teacher);
    await createBehaviourIncident(ctx, { ...baseInput, notify: false });
    expect(repos.notifications.create).not.toHaveBeenCalled();
  });
});

describe("behaviour lifecycle", () => {
  it("update on a CLOSED incident is rejected (immutable)", async () => {
    const { ctx } = makeCtx(
      admin,
      makeRepos(incident({ status: "CLOSED", resolvedByStaffId: "stf-1", resolvedAt: d })),
    );
    await expect(updateBehaviourIncident(ctx, "b-1", { title: "x" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("resolve stamps resolver + resolvedAt and sets RESOLVED", async () => {
    const { ctx, repos } = makeCtx(admin);
    await resolveBehaviourIncident(ctx, "b-1");
    expect(repos.behaviourIncidents.update).toHaveBeenCalledWith(
      "b-1",
      expect.objectContaining({
        status: "RESOLVED",
        resolvedByStaffId: "stf-1",
        resolvedAt: expect.any(Date),
      }),
    );
  });

  it("resolve on a CLOSED incident is rejected", async () => {
    const { ctx } = makeCtx(
      admin,
      makeRepos(incident({ status: "CLOSED", resolvedByStaffId: "stf-1", resolvedAt: d })),
    );
    await expect(resolveBehaviourIncident(ctx, "b-1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("close self-stamps when the incident was never resolved (CHECK guard)", async () => {
    const { ctx, repos } = makeCtx(admin, makeRepos(incident({ status: "OPEN" })));
    await closeBehaviourIncident(ctx, "b-1");
    expect(repos.behaviourIncidents.update).toHaveBeenCalledWith(
      "b-1",
      expect.objectContaining({
        status: "CLOSED",
        resolvedByStaffId: "stf-1",
        resolvedAt: expect.any(Date),
      }),
    );
  });

  it("close keeps the original resolver when already RESOLVED", async () => {
    const resolved = incident({ status: "RESOLVED", resolvedByStaffId: "stf-orig", resolvedAt: d });
    const { ctx, repos } = makeCtx(admin, makeRepos(resolved));
    await closeBehaviourIncident(ctx, "b-1");
    expect(repos.behaviourIncidents.update).toHaveBeenCalledWith(
      "b-1",
      expect.objectContaining({ status: "CLOSED", resolvedByStaffId: "stf-orig", resolvedAt: d }),
    );
  });
});

describe("listBehaviourByStudent — read scope", () => {
  it("parent reads their own child's incidents", async () => {
    const { ctx } = makeCtx(parent);
    const rows = await listBehaviourByStudent(ctx, "st-1");
    expect(rows).toHaveLength(1);
  });

  it("teacher reads a student in their own section (own-section, broader than own-incident RLS §5)", async () => {
    const { ctx } = makeCtx(teacher);
    const rows = await listBehaviourByStudent(ctx, "st-1");
    expect(rows).toHaveLength(1);
  });

  it("teacher is refused a student outside their sections", async () => {
    const { ctx } = makeCtx(teacher, makeRepos(incident(), false));
    await expect(listBehaviourByStudent(ctx, "st-1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("emitLeaveDecided — leave notification integration (ADR-020 §3)", () => {
  const leaveDto: LeaveRequestDto = {
    id: "lr-1",
    schoolId: "s-1",
    enrollmentId: "e-1",
    parentId: "par-1",
    fromDate: "2026-05-01" as LeaveRequestDto["fromDate"],
    toDate: "2026-05-02" as LeaveRequestDto["toDate"],
    reason: "fever",
    status: "APPROVED",
    decidedByStaffId: "stf-1",
    decidedAt: "2026-05-01T00:00:00.000Z" as LeaveRequestDto["decidedAt"],
  };

  it("notifies the requesting parent with a LEAVE notification", async () => {
    const { ctx, repos } = makeCtx(admin);
    await emitLeaveDecided(ctx, leaveDto);
    expect(repos.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LEAVE" }),
    );
    expect(repos.notificationRecipients.createMany).toHaveBeenCalledWith("n-1", ["u-parent"]);
  });
});
