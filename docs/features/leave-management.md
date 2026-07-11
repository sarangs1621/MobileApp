# Feature — Student Leave Management (M4 core · M12 notifications)

**Spec:** `docs/architecture/ADR-011-attendance-data-ownership.md` (the leave workflow) ·
`docs/architecture/ADR-020-discipline-and-leave.md` (M12 notification wrap) · `docs/milestones/M12.md`
**Status:** Workflow implemented in M4 (frozen); M12 adds parent notification on decision.

> **The parent leave workflow already shipped in M4.** M12 does **not** rebuild it — the `LeaveRequest` table,
> `LeaveStatus` enum, apply/cancel/approve/reject/list services, API, web + mobile screens, and `leave:apply/decide/read`
> permissions all exist and are **frozen**. M12's only change is **notifying the parent when a decision is made**
> (M4 predates M10). Attachments and a review remark are **deferred** (ADR-020 Context / deviation #1).

## Model (grain — frozen M4)

```
Enrollment ─1:N─ LeaveRequest   PENDING→APPROVED|REJECTED|CANCELLED
  enrollmentId (→ Enrollment, Restrict)   the child's per-year placement (never Student — ADR-011)
  parentId (→ Parent, Restrict)           the requesting parent
  decidedByStaffId? (→ Staff, Restrict)   the approver (admin / class-teacher), B3 actor
```

- **LeaveRequest** — `schoolId` (loose), `enrollmentId`, `parentId`, `fromDate`/`toDate` (`@db.Date`), `reason`,
  `status @default(PENDING)`, `decidedByStaffId?`, `decidedAt?`. CHECK `fromDate <= toDate`. All FKs **Restrict**.
- `enum LeaveStatus` (PENDING · APPROVED · REJECTED · CANCELLED).
- **Leave never edits attendance automatically** (ADR-011 §7 / ADR-020 deviation #5) — an approved leave writes **no**
  `AttendanceRecord`; it only biases the marking-time **default** when a session is processed. The explicit "excused"
  attendance operation is deferred (the brief itself defers it).

## Workflow (frozen M4)

- **`applyLeave`** (parent, own child) → PENDING · **`cancelLeave`** (parent, own PENDING) → CANCELLED ·
  **`decideLeave`** (`leave:decide` — admin / class-teacher) → APPROVED|REJECTED (rejects a non-PENDING request) ·
  **`listPendingLeaves`** (admin approval queue, child-name enriched) · **`listLeaveByEnrollment`** (history —
  parent own-child / teacher own-section). Every mutation audited in-tx (`LEAVE_APPLY`/`LEAVE_APPROVE`/`LEAVE_REJECT`/
  `LEAVE_CANCEL`).

## M12 change — decision → notification (ADR-020 §3)

The attendance router's `leave.decide` procedure is **repointed** `decideLeave → decideLeaveAndNotify` — the canonical
ADR-018 `*AndNotify` composer. It **calls the frozen `decideLeave` (byte-identical)** and, after it commits,
best-effort notifies the requesting parent with a `Notification(type=LEAVE, actionUrl=/attendance/leave)` (approved vs
rejected copy). The only changed frozen file is the router line (the disclosed ADR-018 §3/#4 pattern); `leave.service.ts`
and every existing `decideLeave` caller/test are untouched.

## Surface

- **Business:** `services/attendance/leave.service` (frozen) + `services/notification/{events,publish-with-notify}`
  (`emitLeaveDecided` + `decideLeaveAndNotify`, M12).
- **API:** `leave.*` tRPC router (frozen) — `decide` now delegates to `decideLeaveAndNotify`.
- **Mobile:** `/attendance/leave` (parent apply + history; frozen M4). LEAVE notifications deep-link there.
- **Web:** `/attendance/leave` (admin approval queue — approve/reject; frozen M4, now auto-notifies).
- **Permissions:** `leave:apply` (P), `leave:decide` (SA + class-teacher), `leave:read` (SA/OA/T/P) — **all frozen M4**.

## Tests

`emitLeaveDecided` unit-tested (M12 business — LEAVE notification to the requesting parent). The M4 leave workflow is
covered by its frozen M4 suite; the `leave.decide` transport permission gates remain covered by the attendance API
tests. The `decideLeaveAndNotify` delegation itself is typecheck-covered (the existing `leave.decide` tests are
pre-repo transport gates — consistent with the codebase's transport-test posture).

## Known limitations

- **No attachment on a leave request** — deferred (overlaps the M12 brief's own out-of-scope "medical documents");
  future-additive as a `LeaveAttachment` companion table (no ALTER of the frozen table).
- **No reviewer remark on a decision** — deferred (a new column would need a forbidden ALTER; the `LEAVE_APPROVE`/
  `LEAVE_REJECT` AuditLog already records the decision).
- **No explicit "excused" attendance write** — approved leave biases only the marking default (ADR-011 §7); the
  explicit excused operation is future work.
- **Field names diverge from the M12 brief** (`fromDate/toDate`, `parentId`, `decidedByStaffId`) — M4's names are
  canonical (the m3-naming-decisions PRD-divergence pattern); a second `LeaveRequest`/`LeaveStatus` is impossible
  (Prisma name collision) and forbidden (freeze).
