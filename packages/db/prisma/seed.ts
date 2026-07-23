import { PrismaClient } from "@prisma/client";
import { adminCreateUser, adminFindUserId, createAdminClient } from "@repo/auth";

/**
 * QA seed (TEST DATA — removable). Creates one demo school with login-capable
 * accounts for every role plus a realistic academic structure, so a tester can
 * sign in as each role and exercise every workflow. Idempotent: re-running
 * upserts by fixed ids and find-or-creates the Supabase auth users.
 *
 * Run:   pnpm --filter @repo/db seed
 * Wipe:  pnpm --filter @repo/db seed:teardown   (SEED_WIPE_CONFIRM=yes)
 *
 * Requires env: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE.
 * Everything lives under schoolId "seed-demo-school" for clean teardown.
 */

const SCHOOL_ID = "seed-demo-school";
const YEAR_ID = "seed-year-2026";
const PASSWORD = "Test@12345";
const PARENT_PHONE = "+919000000001";

const STAFF = [
  {
    key: "super",
    email: "super@sgv.seed",
    role: "SUPER_ADMIN",
    name: "Priya Nair",
    emp: "EMP-001",
  },
  {
    key: "office",
    email: "office@sgv.seed",
    role: "OFFICE_ADMIN",
    name: "Anil Kumar",
    emp: "EMP-002",
  },
  {
    key: "acct",
    email: "accountant@sgv.seed",
    role: "ACCOUNTANT",
    name: "Suresh Rao",
    emp: "EMP-003",
  },
  {
    key: "teacher",
    email: "teacher@sgv.seed",
    role: "TEACHER",
    name: "Meera Patel",
    emp: "EMP-004",
  },
] as const;

const STUDENTS = [
  {
    id: "seed-stu-1",
    adm: "ADM-001",
    first: "Aarav",
    last: "Shah",
    cls: "seed-class-1",
    sec: "seed-sec-1a",
    roll: 1,
  },
  {
    id: "seed-stu-2",
    adm: "ADM-002",
    first: "Diya",
    last: "Mehta",
    cls: "seed-class-1",
    sec: "seed-sec-1a",
    roll: 2,
  },
  {
    id: "seed-stu-3",
    adm: "ADM-003",
    first: "Kabir",
    last: "Desai",
    cls: "seed-class-1",
    sec: "seed-sec-1a",
    roll: 3,
  },
  {
    id: "seed-stu-4",
    adm: "ADM-004",
    first: "Anaya",
    last: "Joshi",
    cls: "seed-class-2",
    sec: "seed-sec-2a",
    roll: 1,
  },
  {
    id: "seed-stu-5",
    adm: "ADM-005",
    first: "Vivaan",
    last: "Trivedi",
    cls: "seed-class-2",
    sec: "seed-sec-2a",
    roll: 2,
  },
] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const supabase = createAdminClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE"),
  );
  try {
    // 1) Supabase auth users (find-or-create → their UID becomes User.id).
    const uid: Record<string, string> = {};
    for (const s of STAFF) {
      uid[s.key] =
        (await adminFindUserId(supabase, { email: s.email })) ??
        (await adminCreateUser(supabase, { email: s.email, password: PASSWORD }));
    }
    const parentUid =
      (await adminFindUserId(supabase, { phone: PARENT_PHONE })) ??
      (await adminCreateUser(supabase, { phone: PARENT_PHONE }));
    const U = (key: string): string => {
      const value = uid[key];
      if (value === undefined) throw new Error(`missing uid for ${key}`);
      return value;
    };

    // 2) School.
    await prisma.school.upsert({
      where: { id: SCHOOL_ID },
      create: {
        id: SCHOOL_ID,
        name: "Sri Gujarati Vidyalaya (DEMO)",
        address: "Kozhikode, Kerala",
      },
      update: {},
    });

    // 3) Staff users + employment profiles.
    for (const s of STAFF) {
      const sid = U(s.key);
      await prisma.user.upsert({
        where: { id: sid },
        create: { id: sid, schoolId: SCHOOL_ID, role: s.role, status: "ACTIVE", email: s.email },
        update: { role: s.role, status: "ACTIVE", email: s.email },
      });
      await prisma.staff.upsert({
        where: { userId: sid },
        create: { schoolId: SCHOOL_ID, userId: sid, name: s.name, employeeId: s.emp },
        update: { name: s.name },
      });
    }

    // 4) Parent user + profile.
    await prisma.user.upsert({
      where: { id: parentUid },
      create: {
        id: parentUid,
        schoolId: SCHOOL_ID,
        role: "PARENT",
        status: "ACTIVE",
        phone: PARENT_PHONE,
      },
      update: { status: "ACTIVE", phone: PARENT_PHONE },
    });
    const parent = await prisma.parent.upsert({
      where: { userId: parentUid },
      create: { schoolId: SCHOOL_ID, userId: parentUid, name: "Reena Shah", phone: PARENT_PHONE },
      update: { name: "Reena Shah" },
    });

    // 5) Academic year (ACTIVE) + a term.
    await prisma.academicYear.upsert({
      where: { id: YEAR_ID },
      create: {
        id: YEAR_ID,
        schoolId: SCHOOL_ID,
        name: "2026–27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        status: "ACTIVE",
      },
      update: { status: "ACTIVE" },
    });
    await prisma.academicTerm.upsert({
      where: { id: "seed-term-1" },
      create: {
        id: "seed-term-1",
        academicYearId: YEAR_ID,
        name: "Term 1",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-09-30"),
      },
      update: {},
    });

    // 6) Classes + sections.
    await prisma.class.upsert({
      where: { id: "seed-class-1" },
      create: { id: "seed-class-1", schoolId: SCHOOL_ID, name: "Grade 1", sortOrder: 1 },
      update: {},
    });
    await prisma.class.upsert({
      where: { id: "seed-class-2" },
      create: { id: "seed-class-2", schoolId: SCHOOL_ID, name: "Grade 2", sortOrder: 2 },
      update: {},
    });
    await prisma.section.upsert({
      where: { id: "seed-sec-1a" },
      create: { id: "seed-sec-1a", classId: "seed-class-1", name: "A" },
      update: {},
    });
    await prisma.section.upsert({
      where: { id: "seed-sec-2a" },
      create: { id: "seed-sec-2a", classId: "seed-class-2", name: "A" },
      update: {},
    });

    // 7) Subjects.
    const subjects = [
      ["seed-sub-guj", "Gujarati"],
      ["seed-sub-math", "Mathematics"],
      ["seed-sub-eng", "English"],
      ["seed-sub-evs", "EVS"],
    ] as const;
    for (const [id, name] of subjects) {
      await prisma.subject.upsert({
        where: { id },
        create: { id, schoolId: SCHOOL_ID, name },
        update: {},
      });
    }

    // 8) Teacher assignments + class-teacher (of Grade 1 A).
    const superStaff = await prisma.staff.findUniqueOrThrow({ where: { userId: U("super") } });
    await prisma.teacherAssignment.upsert({
      where: { id: "seed-ta-1" },
      create: {
        id: "seed-ta-1",
        schoolId: SCHOOL_ID,
        teacherId: U("teacher"),
        subjectId: "seed-sub-guj",
        sectionId: "seed-sec-1a",
      },
      update: {},
    });
    await prisma.teacherAssignment.upsert({
      where: { id: "seed-ta-2" },
      create: {
        id: "seed-ta-2",
        schoolId: SCHOOL_ID,
        teacherId: U("teacher"),
        subjectId: "seed-sub-math",
        sectionId: "seed-sec-1a",
      },
      update: {},
    });
    await prisma.classTeacherAssignment.upsert({
      where: { id: "seed-cta-1" },
      create: {
        id: "seed-cta-1",
        schoolId: SCHOOL_ID,
        academicYearId: YEAR_ID,
        sectionId: "seed-sec-1a",
        teacherId: U("teacher"),
        createdByStaffId: superStaff.id,
      },
      update: {},
    });

    // 9) Students + enrollments; the parent's child is Aarav (student 1).
    for (const s of STUDENTS) {
      await prisma.student.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          schoolId: SCHOOL_ID,
          admissionNo: s.adm,
          firstName: s.first,
          lastName: s.last,
          status: "ACTIVE",
        },
        update: {},
      });
      await prisma.enrollment.upsert({
        where: { id: `seed-enr-${s.id}` },
        create: {
          id: `seed-enr-${s.id}`,
          schoolId: SCHOOL_ID,
          studentId: s.id,
          academicYearId: YEAR_ID,
          classId: s.cls,
          sectionId: s.sec,
          rollNo: s.roll,
          status: "ACTIVE",
        },
        update: {},
      });
    }
    await prisma.studentParent.upsert({
      where: {
        studentId_parentId_relationship: {
          studentId: "seed-stu-1",
          parentId: parent.id,
          relationship: "MOTHER",
        },
      },
      create: {
        studentId: "seed-stu-1",
        parentId: parent.id,
        relationship: "MOTHER",
        isPrimary: true,
      },
      update: { isPrimary: true },
    });

    console.warn(
      `[seed] done. Staff logins: super/office/accountant/teacher@sgv.seed (password ${PASSWORD}). ` +
        `Parent login: phone ${PARENT_PHONE} (needs a Supabase test-OTP for that number). ` +
        `Parent's child = Aarav Shah, Grade 1 A.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
});
