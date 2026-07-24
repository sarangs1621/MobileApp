-- Remove the unused ACCOUNTANT role (P1-3 / BUG-3).
-- The role carried no functional permissions (self-profile + own notifications only)
-- and is dropped from the product; the QA seed account is removed in the same change.
-- Postgres cannot drop a value from an enum in place, so swap the type. `User.role`
-- is the only column of type "Role" and has no default, so the swap is a single
-- ALTER COLUMN. Any pre-existing ACCOUNTANT row would fail the USING cast — expected,
-- since the value is being retired (there are none outside the removed seed).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'OFFICE_ADMIN', 'TEACHER', 'PARENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;
