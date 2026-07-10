-- M7 ReportCard relationship proofs (Step-3: FK delete-rule matrix + rollback-safe probes).
-- ReportCard is a LEAF reporting table: 9 FKs, ALL Restrict, no Cascade/SetNull in OR out
-- (ADR-014 §8 — a published card can never be orphaned or cascade-deleted; history survives
-- promotion/withdrawal/transfer by construction because it keys to the immutable enrollment).

-- ===== 1. FK delete-rule matrix (introspection) — expect 9 rows, ALL 'RESTRICT' =====
SELECT
  conname AS fk,
  confrelid::regclass AS references,
  CASE confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
       WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' WHEN 'a' THEN 'NO ACTION' END AS on_delete
FROM pg_constraint
WHERE conrelid = '"ReportCard"'::regclass AND contype = 'f'
ORDER BY conname;

\echo ''
\echo '>>> matrix must be 9 rows, on_delete = RESTRICT for every one (0 CASCADE, 0 SET NULL).'
\echo '>>> ReportCard has NO child tables, so no cascade path OUT either (leaf).'
\echo ''

-- ===== 2. rollback-safe probes =====
BEGIN;

CREATE FUNCTION pg_temp.expect_reject(_label text, _sql text) RETURNS void AS $$
BEGIN
  EXECUTE _sql;
  RAISE WARNING 'FAIL % — statement was ACCEPTED (delete should have been blocked)', _label;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS % — blocked: %', _label, SQLERRM;
END $$ LANGUAGE plpgsql;

-- fixtures + one PUBLISHED annual card + one EXAM card + one TERM card
INSERT INTO "School"(id,name,"updatedAt") VALUES ('sch','S',now());
INSERT INTO "User"(id,"schoolId",role,"updatedAt") VALUES ('usr','sch','OFFICE_ADMIN',now());
INSERT INTO "Staff"(id,"schoolId","userId","employeeId","updatedAt") VALUES ('stf','sch','usr','E1',now());
INSERT INTO "AcademicYear"(id,"schoolId",name,"startDate","endDate","updatedAt") VALUES ('ay','sch','2026','2026-04-01','2027-03-31',now());
INSERT INTO "AcademicTerm"(id,"academicYearId",name,"startDate","endDate","updatedAt") VALUES ('term','ay','T1','2026-04-01','2026-09-30',now());
INSERT INTO "Class"(id,"schoolId",name,"updatedAt") VALUES ('cls','sch','G5',now());
INSERT INTO "Section"(id,"classId",name,"updatedAt") VALUES ('sec','cls','A',now());
INSERT INTO "Section"(id,"classId",name,"updatedAt") VALUES ('sec2','cls','B',now());
INSERT INTO "Student"(id,"schoolId","admissionNo","firstName","lastName","updatedAt") VALUES ('std','sch','A1','Asha','K',now());
INSERT INTO "Enrollment"(id,"schoolId","studentId","academicYearId","classId","sectionId","updatedAt") VALUES ('enr','sch','std','ay','cls','sec',now());
INSERT INTO "Exam"(id,"schoolId","academicYearId",name,type,"updatedAt") VALUES ('exm','sch','ay','Mid','MID_TERM',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,rank,"rankScope","cohortSize","approvedByStaffId","approvedAt","publishedByStaffId","publishedAt","createdByStaffId","updatedAt")
  VALUES ('rc_ann','sch','enr','ANNUAL',1,'PUBLISHED',3,'SECTION',40,'stf',now(),'stf',now(),'stf',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"examId","createdByStaffId","updatedAt") VALUES ('rc_exam','sch','enr','EXAM','exm','stf',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId","createdByStaffId","updatedAt") VALUES ('rc_term','sch','enr','TERM','term','stf',now());

-- ---- delete-blocked probes (Restrict keeps the card; each must PASS = be blocked) ----
SELECT pg_temp.expect_reject('D1 delete Enrollment under a card (never orphaned; withdrawal/alumni keep cards)',
  $q$DELETE FROM "Enrollment" WHERE id='enr'$q$);
SELECT pg_temp.expect_reject('D2 delete Exam scoped by an EXAM card',
  $q$DELETE FROM "Exam" WHERE id='exm'$q$);
SELECT pg_temp.expect_reject('D3 delete AcademicTerm scoped by a TERM card',
  $q$DELETE FROM "AcademicTerm" WHERE id='term'$q$);
SELECT pg_temp.expect_reject('D4 delete Staff audit actor referenced by a card (B3 durability)',
  $q$DELETE FROM "Staff" WHERE id='stf'$q$);
-- cascade precision: AcademicTerm→AcademicYear is CASCADE, but term→card is RESTRICT, so
-- deleting the YEAR cannot cascade through a term that a card scopes → whole delete blocked.
SELECT pg_temp.expect_reject('D5 delete AcademicYear (cascade to term blocked by card Restrict)',
  $q$DELETE FROM "AcademicYear" WHERE id='ay'$q$);

-- ---- survive-transition probes (in-place enrollment lifecycle; card must be UNTOUCHED) ----
\echo ''
\echo '=== P1 promotion: enrollment status ADMITTED→PROMOTED in place — card survives ==='
UPDATE "Enrollment" SET status='PROMOTED' WHERE id='enr';
SELECT count(*) AS cards_still_attached FROM "ReportCard" WHERE "enrollmentId"='enr';

\echo '=== P2 transfer: enrollment sectionId sec→sec2 in place — snapshot rank frozen, card unchanged ==='
UPDATE "Enrollment" SET "sectionId"='sec2' WHERE id='enr';
SELECT id, rank, "rankScope", status FROM "ReportCard" WHERE id='rc_ann';

\echo '=== P3 withdrawal: status→DROPPED then DELETE enrollment still blocked (card retained) ==='
UPDATE "Enrollment" SET status='DROPPED' WHERE id='enr';
SELECT pg_temp.expect_reject('P3 delete DROPPED enrollment under a card',
  $q$DELETE FROM "Enrollment" WHERE id='enr'$q$);

\echo ''
\echo '>>> probes complete — all D* blocked, all P* cards intact, zero rows persisted (ROLLBACK).'
ROLLBACK;
