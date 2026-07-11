# Status — Student Discipline

- **Status:** Implemented (M12 Steps 1–9 complete) — awaiting milestone approval.
- **Current milestone:** M12 (Student Discipline & Leave Management) — behaviour incidents over frozen M1–M11.
- **Completion:** 100% of M12 discipline scope.
- **Spec / decision:** `docs/architecture/ADR-020-discipline-and-leave.md` · `docs/milestones/M12.md` ·
  `docs/features/discipline.md`
- **Model:** `BehaviourIncident` (schoolId, academicYearId, studentId, enrollmentId, teacherId, category, severity,
  title, description, actionTaken?, status, parentNotified, createdByStaffId, resolvedByStaffId?, resolvedAt?;
  OPEN→IN_PROGRESS→RESOLVED→CLOSED, immutable after CLOSED). Keeps **both** studentId (person, cross-year) +
  enrollmentId (year/section context) — justified divergence from ADR-011. `teacherId → User`; createdBy/resolvedBy
  → Staff. Enums `BehaviourCategory` (7), `BehaviourSeverity` (4), `BehaviourStatus` (4). All FKs **Restrict**; CHECK
  `RESOLVED/CLOSED ⟹ resolved stamps set`; indexes (studentId), (status), (severity), (createdAt), (teacherId), (schoolId).
- **Lifecycle:** admin (`behaviour:manage`, any student, names referring teacher) + teacher (`behaviour:record`,
  own-section, `teacherId` server-set to self, ACTIVE-year enrollment derived) create; update OPEN↔IN_PROGRESS;
  resolve stamps; close is terminal + self-stamps. Every mutation audited in-tx. No hard delete.
- **Create → notify:** optional, post-commit, best-effort M10 `Notification(type=BEHAVIOUR, actionUrl=/behaviour/:id)`
  to the student's parents (reuses M10 `createBulkNotification`/`parentUserIdsForStudent`; severity-mapped priority);
  `parentNotified` flips only on recipients>0; `notify:false` = silent.
- **Read scope:** business-resolved (admin all/console; teacher own + own-section student history; parent own child).
  RLS is **coarse** defense-in-depth (admin ALL / teacher own-incidents / parent own-child / anon none) — the app is
  `service_role`/BYPASSRLS; business own-section read is intentionally broader than own-incident RLS.
- **Surface:** business (`services/behaviour/*`) · `behaviour.*` tRPC router (8 procedures) · mobile (student-profile
  behaviour tab + record form, teacher referrals, detail resolve/close, parent child-picker; BEHAVIOUR deep-link to
  /behaviour/:id) · web `/behaviour` console (student/teacher/severity/status filters + resolve/close + CSV export).
  **Permission-only (no flag).**
- **Tests:** 16 business (authorship, notification integration, lifecycle, read scope, leave emit) + 7 API transport = 23.
  Migration additive + zero drift (Step 2); RLS isolation proven empirically (Step 3 — teacher A ≠ teacher B, parent ≠
  other parent, admin all, anon none); CHECK-vs-stamping proven (Step 4). Full gate green (lint/typecheck 14/14, test
  incl. business 419 / api 346, db:validate, mobile typecheck, web build 36/36 pages).
- **Frozen?** No (freezes on M12 approval). M1–M11 remained frozen; purely additive (1 table + 3 enums + 2
  NotificationType values, proven by `migrate diff` zero-ALTER on any frozen table).
- **Known limitations:** CLOSED immutable (correction = new incident); per-user read scope business-only (coarse RLS);
  teacher own-section read via ACTIVE-year enrollment; `update` status OPEN↔IN_PROGRESS guaranteed by type+Zod+CHECK
  (not a service guard); no incident file attachment (future-additive).
