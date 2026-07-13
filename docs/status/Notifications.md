# Status — Notifications & Communication

- **Status:** Implemented (M10 Steps 1–10 complete) — awaiting milestone approval. In-app notifications built;
  **push delivery wired in Phase 1** (Expo adapter + `DeviceToken` registration + fan-out from
  `createBulkNotification`, env-gated `PUSH_NOTIFICATIONS_ENABLED`). SMS/WhatsApp remain the future ADR-005 seam.
  Operator blockers before push reaches a device: set an EAS `projectId` in `apps/mobile/app.json`
  (`getExpoPushTokenAsync` returns null without it) and enable `PUSH_NOTIFICATIONS_ENABLED` server-side.
- **Current milestone:** M10 (Notifications & Communication) — in-app notifications over frozen M1–M9.
- **Completion:** 100% of M10 (in-app) scope
- **Spec / decision:** `docs/architecture/ADR-018-notification-architecture.md` · `docs/milestones/M10.md` ·
  `docs/features/notifications.md`
- **Models:** `Notification` (immutable event: type, priority, title, body, actionUrl, createdAt — no updatedAt)
  → `NotificationRecipient` (per-user isRead/readAt + isArchived/archivedAt soft delete + createdAt;
  `@@unique(notificationId, userId)`). Two enums (`NotificationType` 8 values, `NotificationPriority` 4). All
  FKs **Restrict**; indexes `(userId,isRead,createdAt)`, `(notificationId)`, `(createdAt)`.
- **Generation:** business-layer `*AndNotify` composition wraps the frozen publish services (Homework/Exam/
  ReportCard) — routers repoint, **services untouched** (ADR-018 §3, the canonical pattern). Events fire
  **after commit**, best-effort (a notify failure is logged, never fails the publish). Announcement is a manual
  admin action. **No duplicates** (the publish guard blocks re-publish).
- **Recipients:** resolved once at emit and stored explicitly — reuse Enrollment/StudentParent (parents of a
  section / a student) + TeacherAssignment (exam section teachers); login-less parents skipped. No dynamic
  recipient query at read time.
- **Surface:** business (`services/notification/*`) · `notification.*` tRPC router (8 procedures) · mobile bell
  + `/notifications` inbox (pull-to-refresh, deep-link, archive) · web dashboard bell + dropdown + `/notifications`
  page + admin announcement composer (bulk school / section). Inbox under `notification:manage_own` (every role,
  self-scope); announcements under `announcement:send` (SA/OA). **Permission-only (no feature flag).**
- **Tests:** 19 business (createBulk/dedup/empty, read state, archive/delete, list DTO, recipient resolution,
  announcement authz+scope) + 8 API transport (protection, permission gate, Zod) = 27. Migration additive + zero
  drift (Step 2); RLS isolation proven — Teacher A ≠ Teacher B, parent ≠ other parent, admin all, anon none
  (Step 3). Full gate green (lint/typecheck/test 35/35, db:validate, mobile typecheck, web build).
- **Frozen?** No (freezes on M10 approval). M1–M9 remained frozen; purely additive (2 tables + 2 enums, proven
  by `migrate diff`; the only frozen-file edits are transport — routers repoint to `*AndNotify`).
- **Known limitations:** **timetable** notifications not auto-emitted (no publish transition → per-entry would
  storm; `TIMETABLE_UPDATED` type reserved, awaiting a coarse publish action); **study material** has no source
  feature (type reserved); emit is **best-effort** (a failure after commit is logged, not retried — the future
  outbox is the durability upgrade); no notification **preferences** (opt-out) yet.
- **Future seam (delivery — was this file's prior scope):** PUSH/SMS/WhatsApp fan out later from the same emit via
  the existing `@repo/notifications` delivery abstraction (ADR-005; interfaces + channel routing exist, no provider
  adapters, no `registerDevice`/`deregisterDevice` yet — REVIEW_FINDINGS B13). `DeviceToken` (M1) is the
  push-registration table. Notification **preferences** = a future additive table keyed on `(userId, type)`.
  Dev PRD v1.3 §4.6, §8.9, §9.
- **Next work:** timetable coarse-publish notify; push/SMS delivery adapters; notification preferences — deferred.
