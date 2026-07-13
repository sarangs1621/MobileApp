import type { Repositories } from "@repo/db";
import type { DeliveryResult, NotificationService } from "@repo/notifications";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Principal } from "../../authorization";
import type { ServiceContext } from "../../context";

import { dispatchPushToUsers } from "./push";

const parent: Principal = { userId: "u-1", schoolId: "s-1", role: "PARENT", status: "ACTIVE" };

function makeCtx(opts: {
  tokens: { userId: string; expoPushToken: string }[];
  results: DeliveryResult[];
}) {
  const deleteByTokens = vi.fn(async (): Promise<number> => 1);
  const sendMany = vi.fn(async (): Promise<DeliveryResult[]> => opts.results);
  const repositories = {
    deviceTokens: {
      listByUserIds: vi.fn(async () => opts.tokens),
      deleteByTokens,
    },
  } as unknown as Repositories;
  const notifications = { sendMany } as unknown as NotificationService;
  const ctx: ServiceContext = {
    user: parent,
    repositories,
    notifications,
    withTransaction: (fn) => fn(repositories),
  };
  return { ctx, deleteByTokens, sendMany };
}

const content = { title: "New homework", body: "Algebra" };

afterEach(() => {
  delete process.env.PUSH_NOTIFICATIONS_ENABLED;
});

describe("dispatchPushToUsers", () => {
  it("prunes tokens Expo rejected as DeviceNotRegistered", async () => {
    process.env.PUSH_NOTIFICATIONS_ENABLED = "true";
    const { ctx, deleteByTokens } = makeCtx({
      tokens: [
        { userId: "u-1", expoPushToken: "good" },
        { userId: "u-1", expoPushToken: "dead" },
      ],
      results: [
        { channel: "PUSH", ok: true, address: "good" },
        { channel: "PUSH", ok: false, error: "DeviceNotRegistered", address: "dead" },
      ],
    });
    await dispatchPushToUsers(ctx, ["u-1"], content);
    expect(deleteByTokens).toHaveBeenCalledWith(["dead"]);
  });

  it("does not prune on transient errors and no-ops when disabled", async () => {
    // disabled: never touches repos even with recipients
    const disabled = makeCtx({ tokens: [{ userId: "u-1", expoPushToken: "x" }], results: [] });
    await dispatchPushToUsers(disabled.ctx, ["u-1"], content);
    expect(disabled.sendMany).not.toHaveBeenCalled();

    process.env.PUSH_NOTIFICATIONS_ENABLED = "true";
    const { ctx, deleteByTokens } = makeCtx({
      tokens: [{ userId: "u-1", expoPushToken: "rate" }],
      results: [{ channel: "PUSH", ok: false, error: "MessageRateExceeded", address: "rate" }],
    });
    await dispatchPushToUsers(ctx, ["u-1"], content);
    expect(deleteByTokens).not.toHaveBeenCalled();
  });
});
