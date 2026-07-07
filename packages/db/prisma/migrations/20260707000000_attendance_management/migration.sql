-- M4 Step 2 — Attendance Management structure (AttendanceSession,
-- AttendanceRecord, LeaveRequest, AttendanceCorrection, Holiday). ADR-011 is the
-- source of truth. RLS is a separate migration (Step 4), the same split M2/M3
-- used (academic_structure + academic_rls; people_management + people_rls).

-- CreateEnum
CREATE TYPE "AttendanceSessionType" AS ENUM ('DAILY', 'SUBJECT');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NATIONAL', 'SCHOOL', 'FESTIVAL', 'EMERGENCY_CLOSURE');

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "sessionType" "AttendanceSessionType" NOT NULL DEFAULT 'DAILY',
    "date" DATE NOT NULL,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByStaffId" TEXT NOT NULL,
    "submittedByStaffId" TEXT,
    "lockedByStaffId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByStaffId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "requestedByStaffId" TEXT NOT NULL,
    "previousStatus" "AttendanceStatus" NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByStaffId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSession_sectionId_date_idx" ON "AttendanceSession"("sectionId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_academicYearId_date_idx" ON "AttendanceSession"("academicYearId", "date");

-- CreateIndex
CREATE INDEX "AttendanceSession_schoolId_idx" ON "AttendanceSession"("schoolId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_schoolId_idx" ON "AttendanceRecord"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_enrollmentId_key" ON "AttendanceRecord"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "LeaveRequest_enrollmentId_status_idx" ON "LeaveRequest"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_parentId_idx" ON "LeaveRequest"("parentId");

-- CreateIndex
CREATE INDEX "LeaveRequest_schoolId_idx" ON "LeaveRequest"("schoolId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_attendanceRecordId_idx" ON "AttendanceCorrection"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_schoolId_idx" ON "AttendanceCorrection"("schoolId");

-- CreateIndex
CREATE INDEX "Holiday_schoolId_idx" ON "Holiday"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_academicYearId_date_key" ON "Holiday"("academicYearId", "date");

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_submittedByStaffId_fkey" FOREIGN KEY ("submittedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_lockedByStaffId_fkey" FOREIGN KEY ("lockedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedByStaffId_fkey" FOREIGN KEY ("decidedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_requestedByStaffId_fkey" FOREIGN KEY ("requestedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_decidedByStaffId_fkey" FOREIGN KEY ("decidedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw-SQL constraints Prisma cannot express (ADR-011)
-- ---------------------------------------------------------------------------

-- One register per section/date/type. TWO partial indexes because Postgres
-- treats NULLs as distinct: a plain unique on the nullable subjectId would let
-- two DAILY sessions (both subjectId NULL) coexist for one section/date.
-- DAILY (subjectId NULL): one whole-day register per section/date.
CREATE UNIQUE INDEX "AttendanceSession_daily_per_section_date"
  ON "AttendanceSession"("sectionId", "date", "sessionType")
  WHERE "subjectId" IS NULL;

-- SUBJECT (subjectId set): one register per section/date/type/subject.
CREATE UNIQUE INDEX "AttendanceSession_subject_per_section_date"
  ON "AttendanceSession"("sectionId", "date", "sessionType", "subjectId")
  WHERE "subjectId" IS NOT NULL;

-- BUSINESS RULE: a leave range must not end before it starts.
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_from_before_to"
  CHECK ("fromDate" <= "toDate");

