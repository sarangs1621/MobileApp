import { PERMISSIONS } from "@repo/constants";

import { assertCan } from "../../authorization";
import type { ServiceContext } from "../../context";

/**
 * Device-token registration (Phase 1, B13). Self-scoped: gated by the same
 * `notification:manage_own` a user already holds for their inbox, and every write
 * is bound to `ctx.user.userId` — a caller can only touch their OWN device. High-
 * frequency, low-value ops (fired on every app launch / logout) — no audit row.
 */

export function registerDevice(
  ctx: ServiceContext,
  input: { expoPushToken: string; platform: "ios" | "android" },
): Promise<void> {
  assertCan(ctx.user, PERMISSIONS.NOTIFICATION_MANAGE_OWN);
  return ctx.repositories.deviceTokens
    .upsert({
      userId: ctx.user.userId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
    })
    .then(() => undefined);
}

export async function deregisterDevice(
  ctx: ServiceContext,
  input: { expoPushToken: string },
): Promise<void> {
  assertCan(ctx.user, PERMISSIONS.NOTIFICATION_MANAGE_OWN);
  await ctx.repositories.deviceTokens.deleteByToken(input.expoPushToken, ctx.user.userId);
}
