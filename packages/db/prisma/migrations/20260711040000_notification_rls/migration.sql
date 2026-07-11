-- ---------------------------------------------------------------------------
-- M10 Step 3 — Row-Level Security for Notifications (ADR-018 §5).
--
-- DEFENSE-IN-DEPTH ONLY (ADR-002). The authoritative gate is the business layer
-- (assertCan(notification:manage_own) + row scope userId = self). The app reaches
-- these tables as service_role (BYPASSRLS): tRPC → business → Prisma, so these
-- policies do NOT touch the app's own path — they only limit DIRECT client-JWT
-- access. Reuses is_academic_admin() (academic_rls). Role/status come from the DB
-- `User` row, never the JWT. `User.id` == Supabase auth UID, so auth.uid() joins
-- straight to a user's NotificationRecipient rows.
--
-- NOTE (single-tenant, ADR-008): policies do NOT match schoolId; tenant scoping
-- lives in the repository layer.
--
-- Model (ADR-018 §5):
--   • NotificationRecipient — admin ALL; the OWNER reads/updates/deletes only OWN
--     rows (userId = auth.uid() — read state, archive, delete). No owner INSERT
--     (only the service, as service_role, creates via createBulk). This is what
--     forces "Teacher A cannot read Teacher B" and "Parent cannot read another
--     parent". Anon: no policy = denied.
--   • Notification — admin ALL; a user SELECTs an event iff a recipient row for
--     auth.uid() exists (EXISTS). The record itself is never client-written. Anon:
--     no policy = denied.
-- Purely additive: enables RLS + policies on the two M10 tables. No frozen policy
-- is altered; no new helper (is_academic_admin reused).
-- ---------------------------------------------------------------------------

-- ---- NotificationRecipient: admin ALL; owner reads/updates/deletes OWN rows ----
ALTER TABLE "NotificationRecipient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_admin_all" ON "NotificationRecipient"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "recipient_read_own" ON "NotificationRecipient"
  FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);
CREATE POLICY "recipient_update_own" ON "NotificationRecipient"
  FOR UPDATE TO authenticated
  USING ("userId" = (SELECT auth.uid())::text)
  WITH CHECK ("userId" = (SELECT auth.uid())::text);
CREATE POLICY "recipient_delete_own" ON "NotificationRecipient"
  FOR DELETE TO authenticated
  USING ("userId" = (SELECT auth.uid())::text);

-- ---- Notification: admin ALL; readable iff the user has a recipient row ----
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_admin_all" ON "Notification"
  FOR ALL TO authenticated
  USING (public.is_academic_admin()) WITH CHECK (public.is_academic_admin());
CREATE POLICY "notification_read_recipient" ON "Notification"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "NotificationRecipient" r
    WHERE r."notificationId" = "Notification".id
      AND r."userId" = (SELECT auth.uid())::text
  ));
