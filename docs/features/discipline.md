# Feature — Student Discipline (M12)

**Spec:** `docs/architecture/ADR-020-discipline-and-leave.md` · `docs/milestones/M12.md`
**Status:** Implemented (M12) — awaiting milestone approval.

Behaviour incidents / teacher referrals over frozen M1–M11: a longitudinal **student** discipline record with an
`OPEN→IN_PROGRESS→RESOLVED→CLOSED` lifecycle, immutable after CLOSED. On create it **optionally** emits an M10
`Notification(type=BEHAVIOUR)` to the student's parents — the only delivery M12 discipline does. **No counselling /
medical records / detention scheduling / push / SMS / email.**

## Model (grain)

```
School ─(loose)─ BehaviourIncident   OPEN→IN_PROGRESS→RESOLVED→CLOSED (immutable after CLOSED)
  studentId (→ Student, Restrict)      the person — history follows across years/enrollments
  enrollmentId (→ Enrollment, Restrict) the year/section/class context the incident occurred in
  teacherId (→ User, Restrict)          the referring/owning teacher — RLS own-incident = teacherId = auth.uid()
  createdBy / resolvedBy (→ Staff)      B3 audit actors
  └─(create, optional)→ M10 Notification(type=BEHAVIOUR, actionUrl=/behaviour/:id) → student's parents
```

- **BehaviourIncident** — `schoolId` (loose, ADR-008), `academicYearId`, `studentId`, `enrollmentId`, `teacherId`,
  `category`, `severity`, `title`, `description`, `actionTaken?`, `status @default(OPEN)`, `parentNotified @default(false)`,
  `createdByStaffId`, `resolvedByStaffId?`, `resolvedAt?`. **Keeps BOTH `studentId` and `enrollmentId`** — a justified
  divergence from the ADR-011 attendance idiom (discipline is a longitudinal *person* record; attendance is per-session).
- `teacherId → User` (RLS `teacherId = auth.uid()`, the ADR-015 teacher-is-User idiom); `createdBy`/`resolvedBy → Staff`
  are the B3 audit actors (an admin may act on a teacher's behalf).
- All FKs **Restrict**. CHECK: `status IN ('RESOLVED','CLOSED') ⟹ resolvedByStaffId IS NOT NULL AND resolvedAt IS NOT NULL`.
- Indexes (brief): `(studentId)`, `(status)`, `(severity)`, `(createdAt)` + `(teacherId)`, `(schoolId)`.
- `enum BehaviourCategory` (DISCIPLINE · BULLYING · UNIFORM · HOMEWORK · MISCONDUCT · LATE · OTHER) ·
  `enum BehaviourSeverity` (LOW · MEDIUM · HIGH · CRITICAL) · `enum BehaviourStatus` (OPEN · IN_PROGRESS · RESOLVED · CLOSED).

## Lifecycle & authoring (ADR-020 §2/§6)

- **Authors:** admins (`behaviour:manage`, any student, names the referring teacher) + teachers (`behaviour:record`,
  own-section students only, `teacherId` **server-set to self**). Parents never author.
- `create` → OPEN (teacher path **derives the ACTIVE-year enrollment** server-side — a client `enrollmentId` is never
  trusted on the teacher path) · `update` edits mutable fields while **OPEN/IN_PROGRESS** (status may only move
  OPEN↔IN_PROGRESS) · `resolve` OPEN/IN_PROGRESS→RESOLVED (stamps `resolvedBy`/`resolvedAt`) · `close` →CLOSED
  (**terminal, immutable**; self-stamps the resolver if it was never resolved, so the CHECK holds).
- Every mutation writes **AuditLog in the same transaction** (ADR-007). No hard delete (a behaviour record is a
  historical assertion with audit — the correction/report-card precedent).

## Create → optional notification (reuse M10)

`create(…, { notify = true })` commits + audits in-tx, then **after commit, best-effort**, resolves the student's
parents (reuse M10 `parentUserIdsForStudent`) and calls `createBulkNotification` (one `Notification(type=BEHAVIOUR,
actionUrl=/behaviour/:id)` + N recipients, severity-mapped priority: CRITICAL/HIGH → HIGH, else NORMAL). `parentNotified`
flips `true` **only when recipients > 0**. A notify failure is caught+logged, never fails the committed create
(ADR-018 §3 posture). `notify:false` records silently.

## Read scope (ADR-020 §5/§6)

Business-resolved (RLS is coarse defense-in-depth — admin ALL / teacher own-incidents / parent own-child / anon none):

| Viewer | Sees |
|---|---|
| Admin | all incidents (the console, filterable by student/teacher/severity/status) |
| Teacher | own referrals + a student's full history when the student is in an own section (**own-section**, broader than the own-incident RLS §5 — business is the gate) |
| Parent | their own child's incidents |

`get()` load-then-asserts scope; the console list is admin-only (`behaviour:manage`).

## Surface

- **Business:** `services/behaviour/*` (behaviour.service, scope, mappers).
- **API:** `behaviour.*` tRPC router (8 procedures) — list (console), listByStudent, listByTeacher, get,
  create, update, resolve, close.
- **Mobile:** student profile → *Behaviour incidents* → history + *Record incident* form; `/behaviour` teacher
  referrals; `/behaviour/[id]` detail (resolve/close); parent `/behaviour/children` → child history; BEHAVIOUR
  notification deep-links to `/behaviour/:id`.
- **Web:** `/behaviour` console — student/teacher/severity/status filters, resolve/close, CSV export.
- **Permissions:** `behaviour:manage` (SA/OA), `behaviour:record` (TEACHER), `behaviour:read` (SA/OA/T/P).
  **Permission-only — no feature flag.**

## Tests

Business (behaviour.service, 16): authorship (teacher `teacherId=self`, out-of-section refused, admin names a valid
teacher, parent refused), notification integration (BEHAVIOUR emit, `parentNotified` only on recipients>0, `notify:false`),
lifecycle (immutable-after-CLOSED, resolve stamps, close self-stamps / keeps original), read scope, plus `emitLeaveDecided`.
API transport (7): protection + permission gates (before any repo call) + Zod. Migration additive + zero drift (Step 2);
RLS isolation proven empirically (Step 3 — teacher A ≠ teacher B, parent ≠ other parent, admin all, anon none).

## Known limitations

- **CLOSED is immutable** — a correction is a new incident, not an edit.
- **Per-user read scope is business-resolved** — RLS is coarse (the app is `service_role`/BYPASSRLS); the business gate
  + tests carry confidentiality; the teacher own-section read is intentionally broader than the own-incident RLS.
- **Teacher own-section read resolves via the ACTIVE-year enrollment** — a teacher does not see a student they no
  longer teach this year.
- **`update` status can only move OPEN↔IN_PROGRESS** — the guarantee is carried by the DTO type + Zod enum + DB CHECK
  (three backstops), not a service-layer guard (no reachable caller can bypass all three).
- **No file attachment on an incident** — not in the brief's field list; future-additive.
