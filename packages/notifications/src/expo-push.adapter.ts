import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

import type { DeliveryResult, NotificationAdapter, OutboundMessage } from "./index";

/**
 * Expo push adapter (Phase 1). The ONLY place the Expo SDK lives — the rest of the
 * app talks to the channel-agnostic {@link NotificationAdapter}. Batches via the
 * SDK's chunking and reports each recipient's outcome so the caller can prune a
 * token Expo rejects with `DeviceNotRegistered` (review finding B13).
 *
 * ponytail: ticket-level pruning only. A token that only fails in the *receipt*
 * (fetched ~15 min later via getPushNotificationReceiptsAsync) is not pruned here;
 * add a receipt-polling job (cron/queue) if stale-token buildup becomes a problem.
 */
export function createExpoPushAdapter(
  opts: { accessToken?: string | undefined } = {},
): NotificationAdapter {
  const expo = new Expo(opts.accessToken ? { accessToken: opts.accessToken } : {});

  async function sendMany(messages: OutboundMessage[]): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    const sendable: { message: ExpoPushMessage; address: string }[] = [];

    for (const m of messages) {
      const address = m.recipient.address;
      // A missing/malformed token can never deliver — report it dead so it is pruned.
      if (!address || !Expo.isExpoPushToken(address)) {
        results.push({
          channel: "PUSH",
          ok: false,
          error: "DeviceNotRegistered",
          ...(address ? { address } : {}),
        });
        continue;
      }
      sendable.push({
        address,
        message: { to: address, title: m.title, body: m.body, ...(m.data ? { data: m.data } : {}) },
      });
    }

    let cursor = 0; // index into `sendable` — chunkPushNotifications preserves order.
    for (const chunk of expo.chunkPushNotifications(sendable.map((s) => s.message))) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await expo.sendPushNotificationsAsync(chunk);
      } catch {
        // Whole-chunk transport failure — a transient error, NOT a reason to prune.
        tickets = chunk.map(() => ({ status: "error", message: "send failed" }));
      }
      for (const ticket of tickets) {
        const { address } = sendable[cursor++]!;
        results.push(
          ticket.status === "ok"
            ? { channel: "PUSH", ok: true, providerMessageId: ticket.id, address }
            : {
                channel: "PUSH",
                ok: false,
                address,
                ...(ticket.details?.error ? { error: ticket.details.error } : {}),
              },
        );
      }
    }
    return results;
  }

  return {
    channel: "PUSH",
    send: async (message) => (await sendMany([message]))[0]!,
    sendMany,
  };
}
