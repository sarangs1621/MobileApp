import { errorFields, logger } from "@repo/core";

import type { ServiceContext } from "../../context";

/**
 * Push fan-out (Phase 1). Called fire-and-forget AFTER `createBulkNotification`
 * commits: the in-app rows are already durable, so push delivery must never fail
 * or delay the triggering mutation. Best-effort throughout — every failure is
 * logged, never thrown.
 *
 * Gated on `PUSH_NOTIFICATIONS_ENABLED` (the same flag that wires the Expo adapter
 * in context.ts). Unset in CI/dev/tests ⇒ this is a clean no-op with no repo/adapter
 * access, so the whole path stays inert without touching any test's mock repos.
 */
export function pushEnabled(): boolean {
  return process.env.PUSH_NOTIFICATIONS_ENABLED === "true";
}

interface PushContent {
  title: string;
  body: string;
  actionUrl?: string | null | undefined;
}

/**
 * Resolve every device of `userIds`, deliver via the PUSH channel, and prune tokens
 * Expo reports as `DeviceNotRegistered` (finding B13).
 *
 * ponytail: floating promise. On serverless (Vercel) the function may be frozen
 * before the Expo HTTP call resolves; the upgrade path is `after()` from the API
 * layer (can't live here in business). Fine pre-go-live for a single school.
 */
export async function dispatchPushToUsers(
  ctx: ServiceContext,
  userIds: string[],
  content: PushContent,
): Promise<void> {
  if (!pushEnabled() || userIds.length === 0) {
    return;
  }
  const tokens = await ctx.repositories.deviceTokens.listByUserIds(userIds);
  if (tokens.length === 0) {
    return;
  }
  const data = content.actionUrl ? { url: content.actionUrl } : undefined;
  const messages = tokens.map((t) => ({
    recipient: { userId: t.userId, address: t.expoPushToken },
    title: content.title,
    body: content.body,
    ...(data ? { data } : {}),
  }));
  const results = await ctx.notifications.sendMany("PUSH", messages);
  const dead = results.flatMap((r) =>
    r.error === "DeviceNotRegistered" && r.address ? [r.address] : [],
  );
  if (dead.length > 0) {
    await ctx.repositories.deviceTokens.deleteByTokens(dead);
  }
}

/** Best-effort, non-blocking wrapper — the shape callers fire post-commit. */
export function dispatchPush(ctx: ServiceContext, userIds: string[], content: PushContent): void {
  if (!pushEnabled()) {
    return;
  }
  void dispatchPushToUsers(ctx, userIds, content).catch((err) => {
    logger.error("push dispatch failed", { route: "notification.push", ...errorFields(err) });
  });
}
