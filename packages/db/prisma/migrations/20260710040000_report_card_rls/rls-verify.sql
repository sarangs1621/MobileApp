-- M7 ReportCard RLS isolation proof (Step-4 verification).
-- Seeds as superuser (RLS bypassed), grants table privs to authenticated/anon,
-- then impersonates each persona (SET LOCAL ROLE + jwt sub) and asserts exactly
-- which rows are visible/writable. Whole run rolls back — no fixture persists.
-- auth.uid() (Supabase uuid) reads current_setting('request.jwt.claim.sub'), so
-- User ids are uuids here (as in production, where User.id == the Supabase auth uid).

-- readable handles → uuid ids
\set admin    '00000000-0000-0000-0000-0000000000a1'
\set ct       '00000000-0000-0000-0000-0000000000c1'
\set subj     '00000000-0000-0000-0000-0000000000c2'
\set parent   '00000000-0000-0000-0000-0000000000d1'
\set stranger '00000000-0000-0000-0000-0000000000d2'

BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ReportCard" TO authenticated, anon;

-- ---- fixtures (as superuser) ----
INSERT INTO "School"(id,name,"updatedAt") VALUES ('sch','S',now());
INSERT INTO "User"(id,"schoolId",role,status,"updatedAt") VALUES
  (:'admin','sch','OFFICE_ADMIN','ACTIVE',now()),
  (:'ct','sch','TEACHER','ACTIVE',now()),
  (:'subj','sch','TEACHER','ACTIVE',now()),
  (:'parent','sch','PARENT','ACTIVE',now()),
  (:'stranger','sch','PARENT','ACTIVE',now());
INSERT INTO "Staff"(id,"schoolId","userId","employeeId","updatedAt") VALUES
  ('st_admin','sch',:'admin','EA',now()),
  ('st_ct','sch',:'ct','ECT',now()),
  ('st_subj','sch',:'subj','ESU',now());
INSERT INTO "AcademicYear"(id,"schoolId",name,"startDate","endDate","updatedAt") VALUES ('ay','sch','2026','2026-04-01','2027-03-31',now());
INSERT INTO "AcademicTerm"(id,"academicYearId",name,"startDate","endDate","updatedAt") VALUES ('term','ay','T1','2026-04-01','2026-09-30',now());
INSERT INTO "Class"(id,"schoolId",name,"updatedAt") VALUES ('cls','sch','G5',now());
INSERT INTO "Section"(id,"classId",name,"updatedAt") VALUES ('secA','cls','A',now()), ('secB','cls','B',now());
INSERT INTO "Subject"(id,"schoolId",name,"updatedAt") VALUES ('subj','sch','Math',now());
-- :ct is the CLASS TEACHER of section A (this year); :subj merely TEACHES a subject in A
INSERT INTO "ClassTeacherAssignment"(id,"schoolId","academicYearId","sectionId","teacherId","createdByStaffId","updatedAt")
  VALUES ('cta','sch','ay','secA',:'ct','st_admin',now());
INSERT INTO "TeacherAssignment"(id,"schoolId","teacherId","subjectId","sectionId") VALUES ('ta','sch',:'subj','subj','secA');
-- students + enrollments: stdA in secA (child of :parent), stdB in secB
INSERT INTO "Student"(id,"schoolId","admissionNo","firstName","lastName","updatedAt") VALUES
  ('stdA','sch','A1','Asha','K',now()), ('stdB','sch','B1','Biju','M',now());
INSERT INTO "Parent"(id,"schoolId",name,phone,"userId","updatedAt") VALUES
  ('par','sch','Parent P','+911',:'parent',now()),
  ('par_str','sch','Stranger','+912',:'stranger',now());
INSERT INTO "StudentParent"("studentId","parentId",relationship) VALUES ('stdA','par','MOTHER');
INSERT INTO "Enrollment"(id,"schoolId","studentId","academicYearId","classId","sectionId","updatedAt") VALUES
  ('enrA','sch','stdA','ay','cls','secA',now()),
  ('enrB','sch','stdB','ay','cls','secB',now());
-- cards: enrA has a TERM DRAFT and an ANNUAL PUBLISHED; enrB has an ANNUAL PUBLISHED
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,"termId",version,status,"createdByStaffId","updatedAt")
  VALUES ('rcA_draft','sch','enrA','TERM','term',1,'DRAFT','st_admin',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,"approvedByStaffId","approvedAt","publishedByStaffId","publishedAt","createdByStaffId","updatedAt")
  VALUES ('rcA_pub','sch','enrA','ANNUAL',1,'PUBLISHED','st_admin',now(),'st_admin',now(),'st_admin',now());
INSERT INTO "ReportCard"(id,"schoolId","enrollmentId",kind,version,status,"approvedByStaffId","approvedAt","publishedByStaffId","publishedAt","createdByStaffId","updatedAt")
  VALUES ('rcB_pub','sch','enrB','ANNUAL',1,'PUBLISHED','st_admin',now(),'st_admin',now(),'st_admin',now());

\echo '================ READ isolation ================'
SELECT set_config('request.jwt.claim.sub',:'admin',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'admin (exp rcA_draft,rcA_pub,rcB_pub)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'ct',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'class-teacher A (exp rcA_draft,rcA_pub)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'subj',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'subject-teacher A (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'parent',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent of A (exp rcA_pub)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'stranger',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'stranger parent (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true) \gset s_
SET LOCAL ROLE anon;
SELECT 'anon (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "ReportCard";
RESET ROLE;

\echo '================ WRITE isolation ================'
SELECT set_config('request.jwt.claim.sub',:'ct',true) \gset s_
SET LOCAL ROLE authenticated;
WITH u AS (UPDATE "ReportCard" SET "classTeacherRemark"='ok' WHERE id='rcA_draft' RETURNING 1)
  SELECT 'class-teacher UPDATE draft (exp 1)' AS op, count(*) AS rows_affected FROM u;
WITH u AS (UPDATE "ReportCard" SET "classTeacherRemark"='no' WHERE id='rcA_pub' RETURNING 1)
  SELECT 'class-teacher UPDATE published (exp 0)' AS op, count(*) AS rows_affected FROM u;
WITH u AS (UPDATE "ReportCard" SET "classTeacherRemark"='no' WHERE id='rcB_pub' RETURNING 1)
  SELECT 'class-teacher UPDATE other-section (exp 0)' AS op, count(*) AS rows_affected FROM u;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'parent',true) \gset s_
SET LOCAL ROLE authenticated;
WITH u AS (UPDATE "ReportCard" SET "classTeacherRemark"='no' WHERE id='rcA_pub' RETURNING 1)
  SELECT 'parent UPDATE own published (exp 0)' AS op, count(*) AS rows_affected FROM u;
RESET ROLE;

ROLLBACK;
