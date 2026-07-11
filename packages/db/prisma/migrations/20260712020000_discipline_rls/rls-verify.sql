-- M12 BehaviourIncident RLS isolation proof (Step-3 verification).
-- Seeds as superuser (RLS bypassed), grants table privs to authenticated/anon,
-- then impersonates each persona (SET LOCAL ROLE + jwt sub) and asserts exactly
-- which rows are visible. Whole run rolls back — no fixture persists.
-- auth.uid() reads current_setting('request.jwt.claim.sub'); User.id == the
-- Supabase auth uid, so ids are uuids here.
--
-- Proves: Teacher A cannot read Teacher B's incident (own-incident scope);
-- Parent cannot read another parent's child's incident; Admin sees all; Anon none.

\set admin '00000000-0000-0000-0000-0000000000a1'
\set tA    '00000000-0000-0000-0000-0000000000c1'
\set tB    '00000000-0000-0000-0000-0000000000c2'
\set pA    '00000000-0000-0000-0000-0000000000d1'
\set pB    '00000000-0000-0000-0000-0000000000d2'

BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON "BehaviourIncident" TO authenticated, anon;

-- ---- fixtures (as superuser) ----
INSERT INTO "School"(id,name,"updatedAt") VALUES ('sch','S',now());
INSERT INTO "AcademicYear"(id,"schoolId",name,"startDate","endDate",status,"updatedAt")
  VALUES ('ay','sch','Y1','2026-04-01','2027-03-31','ACTIVE',now());
INSERT INTO "Class"(id,"schoolId",name,"updatedAt") VALUES ('cls','sch','Grade 10',now());
INSERT INTO "Section"(id,"classId",name,"updatedAt") VALUES ('sec','cls','A',now());
INSERT INTO "User"(id,"schoolId",role,status,"updatedAt") VALUES
  (:'admin','sch','OFFICE_ADMIN','ACTIVE',now()),
  (:'tA','sch','TEACHER','ACTIVE',now()),
  (:'tB','sch','TEACHER','ACTIVE',now()),
  (:'pA','sch','PARENT','ACTIVE',now()),
  (:'pB','sch','PARENT','ACTIVE',now());
INSERT INTO "Staff"(id,"schoolId","userId",name,"employeeId","updatedAt")
  VALUES ('staff1','sch',:'admin','Admin','E1',now());
INSERT INTO "Student"(id,"schoolId","admissionNo","firstName","lastName","updatedAt") VALUES
  ('sA','sch','A001','Child','A',now()),
  ('sB','sch','A002','Child','B',now());
INSERT INTO "Enrollment"(id,"schoolId","studentId","academicYearId","classId","sectionId",status,"updatedAt") VALUES
  ('eA','sch','sA','ay','cls','sec','ACTIVE',now()),
  ('eB','sch','sB','ay','cls','sec','ACTIVE',now());
INSERT INTO "Parent"(id,"schoolId","userId",name,phone,"updatedAt") VALUES
  ('parentA','sch',:'pA','Parent A','111',now()),
  ('parentB','sch',:'pB','Parent B','222',now());
INSERT INTO "StudentParent"("studentId","parentId",relationship) VALUES
  ('sA','parentA','FATHER'),
  ('sB','parentB','FATHER');
-- i1: student sA / enrollment eA / teacher tA ; i2: student sB / eB / teacher tB
INSERT INTO "BehaviourIncident"
  (id,"schoolId","academicYearId","studentId","enrollmentId","teacherId",category,severity,title,description,status,"createdByStaffId","updatedAt")
VALUES
  ('i1','sch','ay','sA','eA',:'tA','DISCIPLINE','LOW','I1','d1','OPEN','staff1',now()),
  ('i2','sch','ay','sB','eB',:'tB','BULLYING','HIGH','I2','d2','OPEN','staff1',now());

\echo '============ READ isolation — BehaviourIncident ============'
SELECT set_config('request.jwt.claim.sub',:'admin',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'admin (exp i1,i2)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'tA',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'teacher A (exp i1 only — NOT teacher B''s i2)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'tB',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'teacher B (exp i2 only)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pA',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent A (exp i1 only — NOT other parent''s i2)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pB',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent B (exp i2 only)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true) \gset s_
SET LOCAL ROLE anon;
SELECT 'anon (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "BehaviourIncident";
RESET ROLE;

ROLLBACK;
