-- ---------------------------------------------------------------------------
-- M12 — Student Discipline (ADR-020).
--
-- One additive table over frozen M1–M11. The LEAVE half of M12 is ALREADY M4's
-- frozen LeaveRequest / LeaveStatus (reused, not rebuilt — ADR-020 Context), so
-- NO leave table or enum is created here; M12's only leave change is a business
-- notification wrap (Step 4).
--
--   • BehaviourIncident — a longitudinal STUDENT discipline record (teacher
--     referral). Lifecycle OPEN→IN_PROGRESS→RESOLVED→CLOSED, immutable after
--     CLOSED (Step 4). Keeps BOTH studentId (person, cross-year) AND enrollmentId
--     (year/section context) — a justified divergence from the ADR-011 attendance
--     idiom (ADR-020 §1). teacherId → User (RLS "own incidents" = teacherId =
--     auth.uid(), the ADR-015 teacher-is-User idiom); createdBy/resolvedBy →
--     Staff are the B3 audit actors. On create it OPTIONALLY emits an M10
--     Notification(type=BEHAVIOUR) to the student's parents via the canonical
--     *AndNotify path (ADR-018 §3) — M10 reused, never edited.
--
-- Two new NotificationType enum VALUES (BEHAVIOUR, LEAVE) are added for the M12
-- fan-outs (behaviour-created → parents; leave approve/reject → parent). This is
-- an ALTER TYPE … ADD VALUE — an enum extension, NOT a frozen-*table* ALTER, and
-- additive (existing rows/reads unaffected; PG 12+ permits ADD VALUE in a
-- migration txn as the values are not used in DML here). ADR-020 §4 / deviation #2.
--
-- All FKs RESTRICT (brief). Every mutation writes AuditLog in the same transaction
-- (ADR-007). RLS is a separate migration (discipline_rls, Step 3).
--
-- Purely additive: creates 3 enums + 2 enum values + 1 table + its indexes + its
-- own FKs. NO frozen table (Student, Enrollment, AcademicYear, User, Staff,
-- Notification) is altered — the *.behaviourIncidents back-relations are VIRTUAL
-- (no SQL column); proven by `prisma migrate diff` (M11 head → schema shows ONLY
-- these additions, zero ALTER on any frozen table).
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "BehaviourCategory" AS ENUM ('DISCIPLINE', 'BULLYING', 'UNIFORM', 'HOMEWORK', 'MISCONDUCT', 'LATE', 'OTHER');

-- CreateEnum
CREATE TYPE "BehaviourSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BehaviourStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterEnum — additive enum VALUES for the M12 notification fan-outs (ADR-020 §4).
-- Not a frozen-table ALTER; the new values are not used in DML in this migration.
ALTER TYPE "NotificationType" ADD VALUE 'BEHAVIOUR';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE';

-- CreateTable
CREATE TABLE "BehaviourIncident" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "category" "BehaviourCategory" NOT NULL,
    "severity" "BehaviourSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "status" "BehaviourStatus" NOT NULL DEFAULT 'OPEN',
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdByStaffId" TEXT NOT NULL,
    "resolvedByStaffId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviourIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex  — a student's discipline history (hot path; brief "student")
CREATE INDEX "BehaviourIncident_studentId_idx" ON "BehaviourIncident"("studentId");

-- CreateIndex  — console filter (brief "status")
CREATE INDEX "BehaviourIncident_status_idx" ON "BehaviourIncident"("status");

-- CreateIndex  — console filter (brief "severity")
CREATE INDEX "BehaviourIncident_severity_idx" ON "BehaviourIncident"("severity");

-- CreateIndex  — date scan / default sort (brief "date")
CREATE INDEX "BehaviourIncident_createdAt_idx" ON "BehaviourIncident"("createdAt");

-- CreateIndex  — listByTeacher + the RLS own-incident path
CREATE INDEX "BehaviourIncident_teacherId_idx" ON "BehaviourIncident"("teacherId");

-- CreateIndex
CREATE INDEX "BehaviourIncident_schoolId_idx" ON "BehaviourIncident"("schoolId");

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_resolvedByStaffId_fkey" FOREIGN KEY ("resolvedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---- CHECK constraint (structural invariant; ADR-020 §1) --------------------
-- A resolved/closed incident always records who resolved it and when — the
-- ReportCard/Announcement published-stamp idiom applied to resolution.
ALTER TABLE "BehaviourIncident" ADD CONSTRAINT "BehaviourIncident_resolved_stamp"
  CHECK ("status" NOT IN ('RESOLVED', 'CLOSED') OR ("resolvedByStaffId" IS NOT NULL AND "resolvedAt" IS NOT NULL));
