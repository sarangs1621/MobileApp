import { withTransaction, type Repositories } from "@repo/db";
import {
  createExpoPushAdapter,
  createNotificationService,
  type NotificationAdapter,
  type NotificationService,
} from "@repo/notifications";

import type { Principal } from "./authorization";
import { repositories } from "./repositories";

/**
 * Everything a use-case service needs: the authenticated authorization context
 * (a DB-built {@link Principal}), the data-access boundary (repositories), the
 * notification abstraction, and `withTransaction` for atomic mutation+audit
 * (DATABASE_CONVENTIONS §11). Services enforce permission + scope here (ADR-002).
 */
export interface ServiceContext {
  user: Principal;
  repositories: Repositories;
  notifications: NotificationService;
  withTransaction: typeof withTransaction;
}

// Adapters are selected by env config (ADR-005). The Expo PUSH adapter is wired
// only when PUSH_NOTIFICATIONS_ENABLED=true, so CI/dev/tests stay a no-op; other
// channels (SMS/WhatsApp) remain unwired pending their providers.
const adapters: NotificationAdapter[] = [];
if (process.env.PUSH_NOTIFICATIONS_ENABLED === "true") {
  adapters.push(createExpoPushAdapter({ accessToken: process.env.EXPO_ACCESS_TOKEN }));
}
const notifications = createNotificationService(adapters);

/** Assemble a per-request {@link ServiceContext} for a resolved principal. */
export function createServiceContext(user: Principal): ServiceContext {
  return { user, repositories, notifications, withTransaction };
}
