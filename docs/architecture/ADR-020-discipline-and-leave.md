# ADR-020 — Student Discipline & Leave Management — M12

**Status:** Accepted — **M12 implemented (Steps 1–9; awaiting milestone approval)** · **Date:** 2026-07-12 · design approved 2026-07-12 (leave = notify-on-decide only; `BehaviourIncident` keeps both `studentId`+`enrollmentId`; two new `NotificationType` values) · **Deciders:** Architecture, Product
**Related:** ADR-002 (business layer is the authorization gate; routers thin) · ADR-003 (repositories; Prisma only in `packages/db`) ·
ADR-007 (AuditLog in-transaction) · ADR-008 (loose `schoolId`) ·
**ADR-011 (M4 — Attendance & the *already-shipped* `LeaveRequest`/`LeaveStatus` this milestone REUSES, not rebuilds)** ·
ADR-015 (`ClassTeacherAssignment`; `teacherId → User`, `createdByStaffId → Staff` actor idiom) ·
**ADR-018 (M10 — the in-app `Notification`/`NotificationRecipient` layer + the canonical `*AndNotify` composition this milestone emits into)** ·
ADR-019 (M11 — the additive-companion-table + coarse-RLS + flagged-deviation precedent this ADR follows) ·
DATABASE_CONVENTIONS (enums, Restrict, loose `schoolId`, `@db.Date`, in-tx audit) ·
PERMISSIONS_MATRIX (`leave:apply/decide/read` — **already exist** from M4; `behaviour:*` added here)
**Precedes:** M12 (Student Discipline & Leave Management) — this ADR fixes the design; Steps 2–9 execute it.

---

> **Milestone framing.** M12 adds **student discipline** (behaviour incidents / teacher referrals) and completes the
> **parent leave workflow's delivery gap** over frozen M1–M11. It is **purely additive** — **one** new table
> (`BehaviourIncident`), **three** new enums (`BehaviourCategory`/`BehaviourSeverity`/`BehaviourStatus`), two new
> `NotificationType` enum **values**, and business `*AndNotify` compositions — with **zero change to any frozen
> M1–M11 table or business service** (proven by `prisma migrate diff` at Step 2). **No fees, payroll, hostel, transport,
> library, inventory, health records, counselling, medical documents, SMS, WhatsApp, push, or biometric integration**
> (brief "NOT included"/"OUT OF SCOPE"). Notification fan-out is **in-app only**, via M10.

## Context — the leave half is ALREADY BUILT (M4/ADR-011)

The brief specifies a `LeaveRequest` model + a `LeaveStatus { PENDING APPROVED REJECTED CANCELLED }` enum and a
create/cancel/approve/reject/list workflow. **All of this already ships in M4** (ADR-011, frozen):

| Brief asks for | Already exists (M4/ADR-011) |
|---|---|
| `LeaveRequest` table | `model LeaveRequest` (schema.prisma) — keyed to `Enrollment`, `Parent`, `Staff` decider; Restrict FKs; `CHECK fromDate <= toDate`; RLS proven |
| `LeaveStatus` enum | `enum LeaveStatus { PENDING APPROVED REJECTED CANCELLED }` — **identical values** |
| `create` | `applyLeave` | `cancel` | `cancelLeave` | `approve`/`reject` | `decideLeave({decision})` |
| `listParent` | `listLeaveByEnrollment` | `listAdmin` | `listPendingLeaves` |
| API / web / mobile | `attendance` router · `attendance/leave/page.tsx` · mobile `attendance/leave.tsx` |
| Permissions | `leave:apply` (P), `leave:decide` (SA/T-classTeacher), `leave:read` (SA/OA/T/P) — **already granted** |
| "Leave approval never edits attendance automatically" (brief Decision) | **Already M4's exact behaviour** — approved leave writes **no** `AttendanceRecord`; it only biases the marking-time **default** (ADR-011 §7). "Excused" is not an eager write. |

Two hard consequences follow, both forced — not chosen:

1. **A second `LeaveRequest` model is impossible** (Prisma model-name collision) and **`LeaveStatus` collides** too.
2. **M12's own rules make reuse the only freeze-legal posture** — "completely additive," "zero frozen-table
   modifications," "**No ALTER on frozen tables**," "zero drift." Adding the brief's extra leave fields
   (`attachmentPath`, `reviewRemark`, or renaming `fromDate/toDate → startDate/endDate`) as **columns** would require
   an `ALTER` on the frozen M4 table — breaking the zero-drift DoD. So M12 **reuses the M4 `LeaveRequest` verbatim**
   and only adds around it. **Field-name divergences in the brief are noted and M4's names kept canonical** — the
   established PRD-divergence pattern (m3-naming-decisions).

**The one real leave gap M12 closes: notifications.** M4 predates M10, so an approve/reject decision notifies nobody.
M12 wraps `decideLeave` in the canonical `*AndNotify` composition (§3). Approved at Step 1 STOP: leave = **notify-on-
decide only** — attachments and a review remark are **deferred** (attachments also overlap the brief's own
"Medical certificates / Medical documents = out of scope" line; a review remark can't be a new column on a frozen
table, and the existing `LEAVE_APPROVE`/`LEAVE_REJECT` AuditLog already records the decision).

The **discipline half is genuinely net-new** — no Behaviour/Incident/Discipline model exists (verified). It is built in full.

## Decision

### 1. One additive model — `BehaviourIncident` — + three enums

```
School ─(loose)─ BehaviourIncident   OPEN→IN_PROGRESS→RESOLVED→CLOSED (immutable after CLOSED)
  studentId  (→ Student, Restrict)     the person the record follows across years/enrollments
  enrollmentId (→ Enrollment, Restrict) year/section/class context of the incident
  teacherId  (→ User, Restrict)         the referring/owning teacher — RLS "own incidents" = teacherId = auth.uid()
  createdByStaffId / resolvedByStaffId (→ Staff, Restrict)  B3 audit actors
  └─(create, optional)→ M10 Notification(type=BEHAVIOUR, actionUrl=/behaviour/:id) → student's parents
```

**`BehaviourIncident`** — `id, schoolId (loose, ADR-008), academicYearId, studentId, enrollmentId, teacherId,
category BehaviourCategory, severity BehaviourSeverity, title, description, actionTaken String?, status
BehaviourStatus @default(OPEN), parentNotified Boolean @default(false), createdByStaffId, resolvedByStaffId String?,
resolvedAt DateTime?, createdAt, updatedAt`. FKs `academicYear`/`student`/`enrollment`/`createdBy` **Restrict**;
`teacher (→ User)` **Restrict**; `resolvedBy (→ Staff)` **Restrict** nullable.

- **`studentId` AND `enrollmentId` are both kept** (Step-1 approval) — a deliberate, justified divergence from the
  ADR-011 idiom ("`enrollmentId` is the *only* link to a student"). Discipline history **follows the person** across
  re-enrollments and academic years (`studentId`), while `enrollmentId` pins the **year/section/class context** the
  incident occurred in. Attendance is per-session and never needs the cross-year person view, so it uses enrollment
  alone; behaviour is a longitudinal student record, so it needs both. Both are indexed (§ below).
- **`teacherId → User`** (not `Staff`) — mirrors `TeacherAssignment`/`ClassTeacherAssignment` (ADR-015): the teacher is
  a *User* identity so RLS "own incidents" is the cheap `teacherId = auth.uid()`. **`createdByStaffId`/`resolvedByStaffId
  → Staff`** are the B3 audit actors (an admin may create/resolve on a teacher's behalf) — the same actor-vs-owner split
  as attendance (`createdByStaffId`) vs. its derived teacher.

**`enum BehaviourCategory { DISCIPLINE BULLYING UNIFORM HOMEWORK MISCONDUCT LATE OTHER }`** — the brief set.
**`enum BehaviourSeverity { LOW MEDIUM HIGH CRITICAL }`** — display/sort weight; also maps to notification priority (§3).
**`enum BehaviourStatus { OPEN IN_PROGRESS RESOLVED CLOSED }`** — the lifecycle (§2).

**Indexes (per brief — student, status, severity, date):** `[studentId]` (a student's history — the hot path),
`[status]`, `[severity]`, `[createdAt]` (the "date" scan / console default sort). Plus `[schoolId]` (tenant) and
`[teacherId]` (listByTeacher + the RLS own-incident path).

**CHECK (raw SQL in the migration, mirrored by a schema comment — DATABASE_CONVENTIONS §3):**
`status IN ('RESOLVED','CLOSED') ⟹ resolvedByStaffId IS NOT NULL AND resolvedAt IS NOT NULL` — a resolved/closed
incident always records who resolved it and when (mirrors ADR-019's `PUBLISHED ⟹ publishedAt` CHECK). **No leave CHECK
is added** — the frozen `LeaveRequest` already carries `CHECK fromDate <= toDate`.

### 2. Behaviour lifecycle & immutability

`OPEN ──▶ IN_PROGRESS ──resolve──▶ RESOLVED ──close──▶ CLOSED` (forward-only).

- **`create`** makes an `OPEN` incident (optionally emits — §3). **`update`** edits mutable fields
  (title/description/category/severity/actionTaken/status among OPEN↔IN_PROGRESS) **while not CLOSED**.
- **`resolve`** sets `RESOLVED` + stamps `resolvedByStaffId`/`resolvedAt`, audited in-tx.
- **`close`** sets `CLOSED` — **terminal**. **A CLOSED incident is immutable** (brief: "Behaviour is immutable after
  CLOSED"): `update`/`resolve`/`close` on a CLOSED row throw `Conflict`. No hard delete (a behaviour record is a
  historical assertion with audit — like the attendance correction and report-card snapshot precedents). Every
  mutation writes AuditLog in the same transaction (ADR-007).

### 3. Notifications — the canonical M10 `*AndNotify` composition (ADR-018 §3), for BOTH events

Both integrations follow the **exact** ADR-018 §3 pattern — a **business-layer** composer calls the domain action,
then **after commit, best-effort**, resolves recipients (reuse `studentParents`/`Parent`→`User`) and calls the existing
M10 emit (`createBulk` → one `Notification` + N `NotificationRecipient` rows, audited). A notification-write failure is
caught+logged, **never** fails the committed action. The router repoints to the composer (one thin business call).

| Event | Composer | Recipients | Type / priority | actionUrl |
|---|---|---|---|---|
| **Behaviour created** | `createBehaviourAndNotify` (new `services/behaviour/`) | the student's parents — `studentParents.listByStudent` → `parent → user` | `BEHAVIOUR` / **CRITICAL·HIGH → `HIGH`, else `NORMAL`** (severity-mapped) | `/behaviour/:id` |
| **Leave approved / rejected** | `decideLeaveAndNotify` (new `services/notification/` composer wrapping **frozen** `decideLeave`) | the request's parent — `leave.parentId → parent → user` | `LEAVE` / `NORMAL` | `/attendance/leave` |

- **`parentNotified`** on `BehaviourIncident` is set `true` by a small **post-commit** update **iff** the emit
  succeeded — so the field honestly reflects whether parents were reached (best-effort; a failed emit leaves it `false`).
- **`decideLeave` (M4, frozen) is untouched** — `decideLeaveAndNotify` *calls* it, exactly like M10's
  `publishHomeworkAndNotify` wraps the frozen `publishHomework`. The only change to a frozen file is the **attendance
  router repointing** `decideLeave → decideLeaveAndNotify` — one thin business call, no orchestration in transport, no
  service edit (the disclosed ADR-018 §3/#4 pattern). The DB freeze proof is unaffected.

### 4. Two new `NotificationType` enum values (`BEHAVIOUR`, `LEAVE`) — additive, not a table ALTER

M10's `NotificationType` has no fitting value for a discipline incident or a leave decision (its values are
homework/exam/report-card/timetable/study-material/announcement/system). Adding **`BEHAVIOUR`** and **`LEAVE`** is an
`ALTER TYPE … ADD VALUE` in the M12 migration — **an enum extension, not a frozen-*table* ALTER**, and additive by
construction (existing rows/reads are unaffected; enums are the codebase's explicitly-extensible idiom — M10 itself
shipped several reserved values). This is the **one** DDL statement in Step 2 that is not a `CREATE`, and it is
flagged for veto at STOP (deviation #2). *Alternative if vetoed:* reuse `SYSTEM` + the deep-link `actionUrl` — functional
but semantically weak and worse for client-side filtering/iconography.

### 5. RLS (Step 3) — coarse, defense-in-depth (business is the real gate; app is `service_role`/BYPASSRLS)

Leave RLS is **already proven** in M4 (`attendance_rls`) and unchanged. New policy for `BehaviourIncident` only:

| Table | Admin (SA/OA) | Teacher | Parent | Anon |
|---|---|---|---|---|
| `BehaviourIncident` | ALL | **own incidents** (`teacherId = auth.uid()`) — SELECT + write | **own child** SELECT (via `enrollment → student` guardian link) | none |
| `LeaveRequest` *(M4 — unchanged)* | ALL | own-section read | own-child (via `enrollment → student → parent`) | none |

Empirical proofs (Step 3, rolled back): **anon denied**; **Teacher A ≠ Teacher B** (forced by `teacherId = auth.uid()`);
**parent ≠ other parent's child**; **admin sees all**. Per-row student/section targeting for parents is the standard
business + coarse-RLS split (ADR-019 §6 precedent).

### 6. Permissions — reuse `leave:*` verbatim; three new `behaviour:*` grants (the M7/M11 manage/scoped/read shape)

- **Leave:** **no new permission** — `leave:apply` (P), `leave:decide` (admin + classTeacher), `leave:read` (SA/OA/T/P)
  already exist and are correct. `decideLeaveAndNotify` checks `leave:decide` (unchanged from `decideLeave`).
- **`behaviour:manage`** (`BEHAVIOUR_MANAGE`) — **SA/OA**, any student: create/update/resolve/close/read all.
- **`behaviour:record`** (`BEHAVIOUR_RECORD`) — **TEACHER**, scoped to **own students** (a `TeacherAssignment` to the
  incident's section) and **own incidents** (`teacherId = self`): create/update/resolve/close. The `report_card:remark`
  shape — every teacher holds it, a scope predicate narrows it. `close` is terminal for any actor (§2).
- **`behaviour:read`** (`BEHAVIOUR_READ`) — **SA/OA/T/P**: admin → all; teacher → own + own-section; **parent →
  own-child only** (the discipline history feed). Accountants: none (out of scope).
- **No feature flag** — discipline/leave are core (the ADR-013/M6, ADR-017/M9, ADR-018/M10, ADR-019/M11 precedent; no
  flag infra exists).

### 7. Storage — none

Leave attachments are **deferred** (Step-1 approval) — no new bucket, no `LeaveAttachment` table. `BehaviourIncident`
has no file field. M12 adds **zero** storage surface.

## Deviations from the literal brief (flagged for veto at STOP)

1. **Leave is REUSED, not rebuilt** — the brief's `LeaveRequest`/`LeaveStatus` and create/cancel/approve/reject/list
   workflow **already ship in frozen M4** (Context). A second table is impossible (name collision) and forbidden
   (freeze/zero-drift). M12 keeps M4's table + field names (`fromDate/toDate`, `parentId`, `decidedByStaffId`) canonical
   and adds **only** the notification wrap. `attachmentPath` + `reviewRemark` are **deferred** (would need a forbidden
   ALTER or a table that overlaps the brief's own out-of-scope "medical documents"). *(Step-1 approval: notify-on-decide only.)*
2. **Two new `NotificationType` enum values** (`BEHAVIOUR`, `LEAVE`) — an additive `ALTER TYPE … ADD VALUE`, **not** a
   frozen-table ALTER (§4). Fallback: reuse `SYSTEM`.
3. **`BehaviourIncident` keeps both `studentId` and `enrollmentId`** — a justified divergence from the ADR-011
   attendance idiom (discipline is a longitudinal *person* record; attendance is per-session). *(Step-1 approval.)*
4. **The leave-notify wrap repoints the frozen M4 attendance router** to `decideLeaveAndNotify` — the disclosed
   ADR-018 §3/#4 pattern (business service + all tables byte-identical; one thin router line changes).
5. **"Excused attendance linkage" (brief) is already satisfied by M4** and the explicit "excused" operation is, per the
   brief itself, deferred ("Attendance receives an explicit 'excused' operation later"). M12 adds **no** attendance
   write — approved leave continues to bias only the marking-time default (ADR-011 §7). No frozen attendance code changes.

## Alternatives considered

1. **Build a fresh `LeaveRequest` table (literal brief).** Rejected — Prisma model/enum name collision with frozen M4;
   violates every M12 freeze rule. The workflow already exists.
2. **A second, differently-named leave table** (e.g. `StudentLeaveApplication`) to add attachments/remark. Rejected —
   two parallel leave systems is pure duplication (YAGNI); the gap is notifications, which wrap the existing table.
3. **`ALTER` the M4 `LeaveRequest`** to add `attachmentPath`/`reviewRemark`/renamed dates. Rejected — explicitly
   forbidden ("No ALTER on frozen tables"); breaks the zero-drift DoD.
4. **`teacherId → Staff`** on `BehaviourIncident`. Rejected — RLS "own incidents" wants `teacherId = auth.uid()` (a
   User); the ADR-015 teacher-is-User idiom. Staff is the *audit actor* (`createdBy`/`resolvedBy`), not the owner.
5. **`enrollmentId` only on `BehaviourIncident`** (strict ADR-011 idiom). Rejected (deviation #3) — loses the cross-year
   person view a discipline record needs.
6. **Reuse `NotificationType.SYSTEM`** instead of new values. Considered as the veto-fallback for #2 — functional but
   weak semantics.

## Consequences

- (+) **Purely additive** — one table + three enums + two enum values + `*AndNotify` composers; every frozen M1–M11
  **table and business service untouched** (proven by `migrate diff` at Step 2; back-relation fields emit no columns).
- (+) **No duplicate leave system** — the frozen M4 workflow is reused; M12 closes only its notification gap.
- (+) **Reuses M10 for delivery** — both events use the canonical `*AndNotify` path; no new emit infrastructure, no new
  notification type *shape*.
- (+) **Minimal permission surface** — leave grants reused verbatim; three new `behaviour:*` grants (the M7/M11 shape); no flag.
- (−) **Leave attachments + review remark are not shipped** (deviation #1) — future-additive (a `LeaveAttachment`
  companion table if/when medical documents come into scope).
- (−) **Per-row parent targeting is business + coarse RLS** (§5) — the codebase's standing defense-in-depth posture.
- (−) **CLOSED behaviour is immutable** (§2) — a correction is a new incident, not an edit (the audit/report-card precedent).

## STOP — Step 1 boundary — ✅ APPROVED 2026-07-12

Step 1 approved with the product decisions folded in: **leave = notify-on-decide only** (reuse frozen M4, defer
attachment/remark); **`BehaviourIncident` keeps both `studentId` + `enrollmentId`**; **two new `NotificationType`
values** (`BEHAVIOUR`/`LEAVE`, not the `SYSTEM` fallback). All five deviations stand as designed. Steps 2–9 executed
it: additive migration (zero-ALTER, zero-drift — Step 2), coarse RLS with empirical isolation proofs (Step 3), business
layer with the canonical `*AndNotify` wraps (Step 4), thin API + leave-decide repoint (Step 5), mobile (Step 6), web
console + CSV (Step 7), tests + full gate green (Step 8), this documentation (Step 9). **M12 complete — awaiting
milestone approval to freeze.**

## Implementation notes (Steps 2–9, folded back)

- **Deviation #2 realised as designed** — `ALTER TYPE "NotificationType" ADD VALUE 'BEHAVIOUR'/'LEAVE'` in the M12
  migration; an enum extension, not a frozen-table ALTER (the `migrate diff` shows only CREATEs + this ADD VALUE, zero
  ALTER on any frozen table).
- **Advisor-hardened at Step 4** — the teacher create path **derives** the ACTIVE-year enrollment (never trusts a
  client `enrollmentId` — a stale-year guard); `close` self-stamps the resolver so the CHECK holds from any pre-CLOSED
  state; a coarse permission gate runs before any data access (Step 8).
- **Calendar view (brief Step 7) deferred** — M11's school calendar already ships; a leave/behaviour calendar is not in
  the M12 DoD (YAGNI, future-additive).
- **Two documented thin test spots** — `update` status is OPEN↔IN_PROGRESS by type+Zod+CHECK (three backstops, no
  service guard); `decideLeaveAndNotify` delegation is typecheck-covered (existing `leave.decide` tests are pre-repo).
