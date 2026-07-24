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
// QA bypass: the parent also gets an email+password so a tester can sign in via
// the Staff portal (which loads the PARENT app — role comes from auth.me) WITHOUT
// a phone OTP. Real parents have no email/password, so this can't be used in prod.
const PARENT_EMAIL = "parent@sgv.seed";

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
      (await adminFindUserId(supabase, { email: PARENT_EMAIL })) ??
      (await adminCreateUser(supabase, {
        email: PARENT_EMAIL,
        password: PASSWORD,
        phone: PARENT_PHONE,
      }));
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
        email: PARENT_EMAIL,
      },
      update: { status: "ACTIVE", phone: PARENT_PHONE, email: PARENT_EMAIL },
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

    // 10) Grade scale (default) — a resolvable scale is required so an exam
    // register can LOCK and a report card can generate. Exam.gradeScaleId is
    // nullable (falls back to the school's isDefault scale), but we wire it
    // explicitly for clarity. Bands are half-open [minPercent, maxPercent); the
    // top band uses a >100 sentinel so a perfect 100 still lands in a band.
    await prisma.gradeScale.upsert({
      where: { schoolId_name: { schoolId: SCHOOL_ID, name: "Default Grade Scale" } },
      create: {
        id: "seed-gradescale-1",
        schoolId: SCHOOL_ID,
        name: "Default Grade Scale",
        isDefault: true,
      },
      update: { isDefault: true },
    });
    const gradeBands = [
      ["seed-gradeband-aplus", "A+", 90, 100.01, 10],
      ["seed-gradeband-a", "A", 75, 90, 9],
      ["seed-gradeband-b", "B", 60, 75, 8],
      ["seed-gradeband-c", "C", 45, 60, 7],
      ["seed-gradeband-d", "D", 35, 45, 6],
      ["seed-gradeband-f", "F", 0, 35, 0],
    ] as const;
    for (const [id, grade, minPercent, maxPercent, gradePoint] of gradeBands) {
      await prisma.gradeBand.upsert({
        where: { gradeScaleId_grade: { gradeScaleId: "seed-gradescale-1", grade } },
        create: {
          id,
          gradeScaleId: "seed-gradescale-1",
          grade,
          minPercent,
          maxPercent,
          gradePoint,
        },
        update: {},
      });
    }

    // 11) Exam (unpublished) + assessments for the teacher's assigned subjects.
    await prisma.exam.upsert({
      where: { academicYearId_name: { academicYearId: YEAR_ID, name: "Term 1 Unit Test" } },
      create: {
        id: "seed-exam-1",
        schoolId: SCHOOL_ID,
        academicYearId: YEAR_ID,
        gradeScaleId: "seed-gradescale-1",
        name: "Term 1 Unit Test",
        type: "UNIT_TEST",
        displayOrder: 1,
        isPublished: false,
      },
      update: {},
    });
    await prisma.assessment.upsert({
      where: { examId_subjectId: { examId: "seed-exam-1", subjectId: "seed-sub-math" } },
      create: {
        id: "seed-assess-math",
        schoolId: SCHOOL_ID,
        examId: "seed-exam-1",
        subjectId: "seed-sub-math",
        maxTheory: 100,
        maxPractical: null, // theory-only
        passMark: 35,
        displayOrder: 1,
      },
      update: {},
    });
    await prisma.assessment.upsert({
      where: { examId_subjectId: { examId: "seed-exam-1", subjectId: "seed-sub-guj" } },
      create: {
        id: "seed-assess-guj",
        schoolId: SCHOOL_ID,
        examId: "seed-exam-1",
        subjectId: "seed-sub-guj",
        maxTheory: 100,
        maxPractical: null, // theory-only
        passMark: 35,
        displayOrder: 2,
      },
      update: {},
    });

    // 12) Exam register (Assessment × Section) — left DRAFT + EMPTY so the
    // teacher enters marks during QA. Do NOT pre-create Mark rows.
    await prisma.examSection.upsert({
      where: {
        assessmentId_sectionId: {
          assessmentId: "seed-assess-math",
          sectionId: "seed-sec-1a",
        },
      },
      create: {
        id: "seed-examsec-math-1a",
        schoolId: SCHOOL_ID,
        assessmentId: "seed-assess-math",
        sectionId: "seed-sec-1a",
        status: "DRAFT",
        createdByStaffId: superStaff.id,
      },
      update: {},
    });

    // 13) Fee structure (per-year template) + line-item components. Amounts are
    // in PAISE (₹5000 = 500000, ₹500 = 50000).
    await prisma.feeStructure.upsert({
      where: { id: "seed-fee-struct-1" },
      create: {
        id: "seed-fee-struct-1",
        schoolId: SCHOOL_ID,
        academicYearId: YEAR_ID,
        name: "Grade 1 — Term 1 Fees",
        description: "Term 1 tuition and activity fees for Grade 1.",
        active: true,
      },
      update: {},
    });
    const feeComponents = [
      ["seed-fee-comp-tuition", "Tuition", 500000, 1, true],
      ["seed-fee-comp-activity", "Activity", 50000, 2, false],
    ] as const;
    for (const [id, name, amount, order, mandatory] of feeComponents) {
      await prisma.feeComponent.upsert({
        where: { id },
        create: {
          id,
          feeStructureId: "seed-fee-struct-1",
          name,
          amount,
          order,
          mandatory,
        },
        update: {},
      });
    }

    // 14) Invoices — one ISSUED (unpaid) invoice per Grade 1 A student, so an
    // office/super admin can record a payment against them during QA. totalAmount
    // snapshots the structure total (500000 + 50000 = 550000 paise); balance =
    // total while unpaid. (OVERDUE is compute-on-read, never stored.)
    const INVOICE_TOTAL = 550000; // paise
    const invoices = [
      ["seed-inv-1", "seed-stu-1", "seed-enr-seed-stu-1", "INV-SEED-001"],
      ["seed-inv-2", "seed-stu-2", "seed-enr-seed-stu-2", "INV-SEED-002"],
      ["seed-inv-3", "seed-stu-3", "seed-enr-seed-stu-3", "INV-SEED-003"],
    ] as const;
    for (const [id, studentId, enrollmentId, invoiceNumber] of invoices) {
      await prisma.invoice.upsert({
        where: { id },
        create: {
          id,
          schoolId: SCHOOL_ID,
          studentId,
          enrollmentId,
          feeStructureId: "seed-fee-struct-1",
          invoiceNumber,
          issueDate: new Date("2026-04-05"),
          dueDate: new Date("2026-04-30"),
          status: "ISSUED",
          totalAmount: INVOICE_TOTAL,
          paidAmount: 0,
          balanceAmount: INVOICE_TOTAL,
          createdByStaffId: superStaff.id,
        },
        update: {},
      });
    }

    console.warn(
      `[seed] done. Staff logins: super/office/teacher@sgv.seed (password ${PASSWORD}). ` +
        `Parent: sign in via the STAFF PORTAL with ${PARENT_EMAIL} / ${PASSWORD} (QA bypass — loads the ` +
        `parent app; no OTP needed). Real parent login is phone ${PARENT_PHONE} once phone OTP is set up. ` +
        `Parent's child = Aarav Shah, Grade 1 A. ` +
        `Exam "Term 1 Unit Test" (DRAFT Maths register for Grade 1 A — teacher enters marks) + ` +
        `3 ISSUED unpaid invoices (₹5,500 each) for Grade 1 A students, ready for a QA payment.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
});
