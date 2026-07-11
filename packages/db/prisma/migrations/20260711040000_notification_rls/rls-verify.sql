-- M10 Notification RLS isolation proof (Step-3 verification).
-- Seeds as superuser (RLS bypassed), grants table privs to authenticated/anon,
-- then impersonates each persona (SET LOCAL ROLE + jwt sub) and asserts exactly
-- which rows are visible/writable. Whole run rolls back — no fixture persists.
-- auth.uid() (Supabase uuid) reads current_setting('request.jwt.claim.sub'), so
-- User ids are uuids here (as in production, where User.id == the Supabase auth uid).
--
-- Proves: Teacher A cannot read Teacher B; Parent cannot read another parent;
-- Admin sees all; Anon none; a shared ANNOUNCEMENT reaches only its own recipients;
-- write (markRead/archive/delete) is confined to own rows.

\set admin '00000000-0000-0000-0000-0000000000a1'
\set tA    '00000000-0000-0000-0000-0000000000c1'
\set tB    '00000000-0000-0000-0000-0000000000c2'
\set pA    '00000000-0000-0000-0000-0000000000d1'
\set pB    '00000000-0000-0000-0000-0000000000d2'

BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Notification" TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "NotificationRecipient" TO authenticated, anon;

-- ---- fixtures (as superuser) ----
INSERT INTO "School"(id,name,"updatedAt") VALUES ('sch','S',now());
INSERT INTO "User"(id,"schoolId",role,status,"updatedAt") VALUES
  (:'admin','sch','OFFICE_ADMIN','ACTIVE',now()),
  (:'tA','sch','TEACHER','ACTIVE',now()),
  (:'tB','sch','TEACHER','ACTIVE',now()),
  (:'pA','sch','PARENT','ACTIVE',now()),
  (:'pB','sch','PARENT','ACTIVE',now());

-- notifications: n1→tA, n2→tB, n3→pA, n4→pB, n5 ANNOUNCEMENT → tA + pA (shared)
INSERT INTO "Notification"(id,"schoolId",type,priority,title,body) VALUES
  ('n1','sch','HOMEWORK_PUBLISHED','NORMAL','HW','hw body'),
  ('n2','sch','EXAM_PUBLISHED','NORMAL','Exam','exam body'),
  ('n3','sch','REPORT_CARD_PUBLISHED','HIGH','Card','card body'),
  ('n4','sch','REPORT_CARD_PUBLISHED','HIGH','Card','card body'),
  ('n5','sch','ANNOUNCEMENT','NORMAL','Notice','notice body');
INSERT INTO "NotificationRecipient"(id,"notificationId","userId") VALUES
  ('r1','n1',:'tA'),
  ('r2','n2',:'tB'),
  ('r3','n3',:'pA'),
  ('r4','n4',:'pB'),
  ('r5','n5',:'tA'),
  ('r6','n5',:'pA');

\echo '============ READ isolation — NotificationRecipient (own rows) ============'
SELECT set_config('request.jwt.claim.sub',:'admin',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'admin (exp r1,r2,r3,r4,r5,r6)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'tA',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'teacher A (exp r1,r5 — NOT teacher B''s r2)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'tB',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'teacher B (exp r2 only)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pA',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent A (exp r3,r6 — NOT other parent''s r4)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pB',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent B (exp r4 only)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true) \gset s_
SET LOCAL ROLE anon;
SELECT 'anon (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "NotificationRecipient";
RESET ROLE;

\echo '============ READ isolation — Notification (EXISTS recipient) ============'
SELECT set_config('request.jwt.claim.sub',:'tA',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'teacher A (exp n1,n5)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "Notification";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pB',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'parent B (exp n4 only)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "Notification";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'admin',true) \gset s_
SET LOCAL ROLE authenticated;
SELECT 'admin (exp n1,n2,n3,n4,n5)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "Notification";
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true) \gset s_
SET LOCAL ROLE anon;
SELECT 'anon (exp <none>)' AS persona, coalesce(string_agg(id,',' ORDER BY id),'<none>') AS visible FROM "Notification";
RESET ROLE;

\echo '============ WRITE isolation — markRead / delete confined to own rows ============'
SELECT set_config('request.jwt.claim.sub',:'tA',true) \gset s_
SET LOCAL ROLE authenticated;
WITH u AS (UPDATE "NotificationRecipient" SET "isRead"=true,"readAt"=now() WHERE id='r1' RETURNING 1)
  SELECT 'teacher A markRead own r1 (exp 1)' AS op, count(*) AS rows_affected FROM u;
WITH u AS (UPDATE "NotificationRecipient" SET "isRead"=true WHERE id='r2' RETURNING 1)
  SELECT 'teacher A markRead teacher B''s r2 (exp 0)' AS op, count(*) AS rows_affected FROM u;
WITH d AS (DELETE FROM "NotificationRecipient" WHERE id='r5' RETURNING 1)
  SELECT 'teacher A delete own r5 (exp 1)' AS op, count(*) AS rows_affected FROM d;
WITH d AS (DELETE FROM "NotificationRecipient" WHERE id='r2' RETURNING 1)
  SELECT 'teacher A delete teacher B''s r2 (exp 0)' AS op, count(*) AS rows_affected FROM d;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',:'pA',true) \gset s_
SET LOCAL ROLE authenticated;
WITH u AS (UPDATE "NotificationRecipient" SET "isArchived"=true WHERE id='r4' RETURNING 1)
  SELECT 'parent A archive other parent''s r4 (exp 0)' AS op, count(*) AS rows_affected FROM u;
RESET ROLE;

ROLLBACK;
