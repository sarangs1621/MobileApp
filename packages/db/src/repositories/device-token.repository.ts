import type { DeviceToken } from "@prisma/client";

import type { DbClient } from "../db-client";

export type { DeviceToken };

/**
 * Persistence for `DeviceToken` (Phase 1, B13) — a user's Expo push address. No
 * authorization here: the register/deregister methods are parameterized by `userId`
 * so the service (after `assertCan` + self-scope) only ever touches its own device;
 * the fan-out reads (`listByUserIds`) and receipt pruning (`deleteByTokens`) are
 * post-authorization side effects of an action the actor was already gated for.
 */
export interface DeviceTokenRepository {
  /** Register/refresh a device. Upserts on the unique `expoPushToken`, reassigning
   *  it to the current user if the same physical device was shared. */
  upsert(input: { userId: string; expoPushToken: string; platform: string }): Promise<DeviceToken>;
  /** Logout cleanup — remove the caller's OWN token. Returns affected-row count. */
  deleteByToken(expoPushToken: string, userId: string): Promise<number>;
  /** Fan-out: every device of a set of recipients. */
  listByUserIds(userIds: string[]): Promise<DeviceToken[]>;
  /** Prune tokens Expo reported as `DeviceNotRegistered` (unique key ⇒ one row each). */
  deleteByTokens(expoPushTokens: string[]): Promise<number>;
}

export function createDeviceTokenRepository(client: DbClient): DeviceTokenRepository {
  return {
    upsert: ({ userId, expoPushToken, platform }) =>
      client.deviceToken.upsert({
        where: { expoPushToken },
        create: { userId, expoPushToken, platform },
        update: { userId, platform, lastSeenAt: new Date() },
      }),
    deleteByToken: async (expoPushToken, userId) => {
      const res = await client.deviceToken.deleteMany({ where: { expoPushToken, userId } });
      return res.count;
    },
    listByUserIds: (userIds) =>
      userIds.length === 0
        ? Promise.resolve([])
        : client.deviceToken.findMany({ where: { userId: { in: userIds } } }),
    deleteByTokens: async (expoPushTokens) => {
      if (expoPushTokens.length === 0) {
        return 0;
      }
      const res = await client.deviceToken.deleteMany({
        where: { expoPushToken: { in: expoPushTokens } },
      });
      return res.count;
    },
  };
}
