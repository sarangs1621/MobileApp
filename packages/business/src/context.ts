import type { AuthUser } from "@repo/auth";
import type { Repositories } from "@repo/db";
import type { NotificationService } from "@repo/notifications";

/**
 * Everything a use-case service needs to run: the authenticated principal, the
 * data-access boundary, and the notification abstraction. Services enforce
 * fine-grained authz scope here and write audit rows (ADR-002, §4.4).
 */
export interface ServiceContext {
  user: AuthUser;
  repositories: Repositories;
  notifications: NotificationService;
}
