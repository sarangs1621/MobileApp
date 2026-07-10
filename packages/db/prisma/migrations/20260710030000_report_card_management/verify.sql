-- M7 ReportCard constraint proofs (Step-2 "validation").
-- expect_reject() runs a bad INSERT and reports PASS if the DB rejects it, FAIL if
-- it is accepted. Valid rows insert directly. Whole run is one tx, rolled back at
-- the end (leaves no fixture behind).

BEGIN;

CREATE FUNCTION pg_temp.expect_reject(_label text, _sql text) RETURNS void AS $$
BEGIN
  EXECUTE _sql;
  RAISE WARNING 'FAIL % — insert was ACCEPTED (should have been rejected)', _label;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS % — rejected: %', _label, SQLERRM;
END $$ LANGUAGE plpgsql;

-- ---- fixtures (minimal FK targets) ----
INSERT INTO "School"(id,name,"updatedAt") VALUES ('sch','Test School',now());
INSERT INTO "User"(id,"schoolId",role,"updatedAt") VALUES ('usr','sch','OFFICE_ADMIN',now());
INSERT INTO "Staff"(id,"schoolId","userId","employeeId","updatedAt") VALUES ('stf','sch','usr','E1',now());
INSERT INTO "AcademicYear"(id,"schoolId",name,"startDate","endDate","updatedAt")
  VALUES ('ay','sch','2026','2026-04-01','2027-03-31',now());
INSERT INTO "AcademicTerm"(id,"academicYearId",name,"startDate","endDate","updatedAt")
  VALUES ('term','ay','T1','2026-04-01','2026-09-30',now());
INSERT INTO "Class"(id,"schoolId",name,"updatedAt") VALUES ('cls','sch','Grade 5',now());
INSERT INTO "Section"(id,"classId",name,"updatedAt") VALUES ('sec','cls','A',now());
INSERT INTO "Student"(id,"schoolId","admissionNo","firstName","lastName","updatedAt")
  VALUES ('std','sch','A1','Asha','K',now());
INSERT INTO "Enrollment"(id,"schoolId","studentId","academicYearId","classId","sectionId","updatedAt")
  VALUES ('enr','sch','std','ay','cls','sec',now());
INSERT INTO "Exam"(id,"schoolId","academicYearId",name,type,"updatedAt")
  VALUES ('exm','sch','ay','Mid Term','MID_TERM',now());

-- ================= VALID inserts (must all succeed) =================
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"examId","createdByStaffId","updatedAt")
  VALUES ('rc_exam_draft','sch','enr','EXAM','exm','stf',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId","createdByStaffId","updatedAt")
  VALUES ('rc_term_draft','sch','enr','TERM','term','stf',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,
    rank,"rankScope","cohortSize","attendancePercentage","gpaSnapshot",
    "createdByStaffId","submittedByStaffId","submittedAt","approvedByStaffId","approvedAt",
    "publishedByStaffId","publishedAt","updatedAt")
  VALUES ('rc_ann_v1','sch','enr','ANNUAL',1,'PUBLISHED',
    3,'SECTION',40,92.5,8.4,
    'stf','stf',now(),'stf',now(),'stf',now(),now());
\echo '=== valid inserts done (no error above = OK) ==='

-- ================= INVALID inserts (each must PASS = be rejected) =================
SELECT pg_temp.expect_reject('P1  kind=EXAM missing examId',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"createdByStaffId","updatedAt") VALUES ('bad1','sch','enr','EXAM','stf',now())$q$);
SELECT pg_temp.expect_reject('P2  kind=EXAM with stray termId',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"examId","termId","createdByStaffId","updatedAt") VALUES ('bad2','sch','enr','EXAM','exm','term','stf',now())$q$);
SELECT pg_temp.expect_reject('P3  kind=ANNUAL with examId',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"examId","createdByStaffId","updatedAt") VALUES ('bad3','sch','enr','ANNUAL','exm','stf',now())$q$);
SELECT pg_temp.expect_reject('P4  APPROVED but approvedAt NULL',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",status,"createdByStaffId","updatedAt") VALUES ('bad4','sch','enr','TERM','term','APPROVED','stf',now())$q$);
SELECT pg_temp.expect_reject('P5  DRAFT but approvedAt set',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",status,"approvedAt","createdByStaffId","updatedAt") VALUES ('bad5','sch','enr','TERM','term','DRAFT',now(),'stf',now())$q$);
SELECT pg_temp.expect_reject('P6  PUBLISHED but publishedAt NULL',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",status,"approvedAt","createdByStaffId","updatedAt") VALUES ('bad6','sch','enr','TERM','term','PUBLISHED',now(),'stf',now())$q$);
SELECT pg_temp.expect_reject('P7  REVOKED but revokedAt NULL',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",status,"approvedAt","publishedAt","createdByStaffId","updatedAt") VALUES ('bad7','sch','enr','TERM','term','REVOKED',now(),now(),'stf',now())$q$);
SELECT pg_temp.expect_reject('P8  version = 0',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",version,"createdByStaffId","updatedAt") VALUES ('bad8','sch','enr','TERM','term',0,'stf',now())$q$);
SELECT pg_temp.expect_reject('P9  rank 5 of cohort 3',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",rank,"cohortSize","createdByStaffId","updatedAt") VALUES ('bad9','sch','enr','TERM','term',5,3,'stf',now())$q$);
SELECT pg_temp.expect_reject('P10 attendance 150%',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId","attendancePercentage","createdByStaffId","updatedAt") VALUES ('bad10','sch','enr','TERM','term',150,'stf',now())$q$);
SELECT pg_temp.expect_reject('P11 absentCount = -1',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId","absentCount","createdByStaffId","updatedAt") VALUES ('bad11','sch','enr','TERM','term',-1,'stf',now())$q$);
SELECT pg_temp.expect_reject('P12 second PUBLISHED annual (dup live published)',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,"approvedAt","publishedAt","createdByStaffId","updatedAt") VALUES ('bad12','sch','enr','ANNUAL',2,'PUBLISHED',now(),now(),'stf',now())$q$);
SELECT pg_temp.expect_reject('P13 duplicate version=1 for annual scope',
  $q$INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,"createdByStaffId","updatedAt") VALUES ('bad13','sch','enr','ANNUAL',1,'DRAFT','stf',now())$q$);

-- ================= supersede-then-publish (R3 correction is legal) =================
\echo '=== C1 correction: supersede v1 then publish v2 in one tx (must succeed) ==='
UPDATE "ReportCard" SET status='SUPERSEDED' WHERE id='rc_ann_v1';
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,"approvedAt","publishedAt","createdByStaffId","updatedAt")
  VALUES ('rc_ann_v2','sch','enr','ANNUAL',2,'PUBLISHED',now(),now(),'stf',now());
SELECT id, version, status FROM "ReportCard" WHERE kind='ANNUAL' AND "enrollmentId"='enr' ORDER BY version;

ROLLBACK;
