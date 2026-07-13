/**
 * @repo/notifications — the single notification abstraction (ADR-005, Dev PRD §4.6).
 *
 * Feature code calls `NotificationService.send(event)`; the service routes to
 * channel adapters. M0 ships the INTERFACES and the channel-routing composition
 * only — NO provider SDKs (Expo/MSG91/Gupshup). Concrete adapters are added,
 * selected by env config, in later milestones.
 */
import type { NotificationChannelKey } from "@repo/constants";

/** A recipient address resolved for a specific channel. */
export interface Recipient {
  userId: string;
  /** Channel-specific address (expo token / phone / null for IN_APP). */
  address?: string;
  locale?: "en" | "ml";
}

/** A channel-agnostic, ready-to-send message. */
export interface OutboundMessage {
  recipient: Recipient;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** The result of one delivery attempt. */
export interface DeliveryResult {
  channel: NotificationChannelKey;
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  /** The recipient address this result is for (so callers can prune a dead token). */
  address?: string;
}

/** One channel implementation (Push/SMS/WhatsApp/InApp). Provider lives behind this. */
export interface NotificationAdapter {
  readonly channel: NotificationChannelKey;
  send(message: OutboundMessage): Promise<DeliveryResult>;
  /** Optional batch path — providers that chunk (Expo) implement this for fan-out. */
  sendMany?(messages: OutboundMessage[]): Promise<DeliveryResult[]>;
}

/** A channel-agnostic event raised by a business service. */
export interface NotificationEvent {
  type: string;
  channels: NotificationChannelKey[];
  message: OutboundMessage;
}

/** Resolves channels per event and dispatches to the matching adapters. */
export interface NotificationService {
  send(event: NotificationEvent): Promise<DeliveryResult[]>;
  /** Batch fan-out on one channel. No adapter for the channel ⇒ empty result. */
  sendMany(channel: NotificationChannelKey, messages: OutboundMessage[]): Promise<DeliveryResult[]>;
}

/**
 * Compose a {@link NotificationService} from the registered adapters. Channels
 * requested by an event with no registered adapter yield a failed result rather
 * than throwing, so one missing channel never blocks the others.
 */
export function createNotificationService(adapters: NotificationAdapter[]): NotificationService {
  const byChannel = new Map<NotificationChannelKey, NotificationAdapter>(
    adapters.map((adapter) => [adapter.channel, adapter]),
  );

  return {
    async send(event) {
      return Promise.all(
        event.channels.map(async (channel) => {
          const adapter = byChannel.get(channel);
          if (!adapter) {
            return { channel, ok: false, error: `No adapter registered for channel ${channel}` };
          }
          return adapter.send(event.message);
        }),
      );
    },
    async sendMany(channel, messages) {
      const adapter = byChannel.get(channel);
      if (!adapter || messages.length === 0) {
        return [];
      }
      if (adapter.sendMany) {
        return adapter.sendMany(messages);
      }
      return Promise.all(messages.map((m) => adapter.send(m)));
    },
  };
}

export { createExpoPushAdapter } from "./expo-push.adapter";
