import { useTranslation } from "@repo/i18n";
import type { NotificationDto } from "@repo/types";
import { useRouter, type Href } from "expo-router";
import { Archive } from "phosphor-react-native";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { Header } from "../../../components/behaviour-ui";
import { deepLinkForType, timeAgo } from "../../../components/notifications-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Notification inbox (M10, ADR-018 Step 7). The caller's own live notifications
 * (`notification.list`), newest first. Pull to refresh; tapping a row marks it read
 * and deep-links to its destination screen; each row can be archived. "Mark all
 * read" clears the badge. All mutations invalidate the list + unread count.
 */
export default function NotificationsScreen() {
  const { dict } = useTranslation();
  const t = dict.notifications;
  const router = useRouter();
  const utils = trpc.useUtils();
  const list = trpc.notification.list.useQuery({});
  const notifications = list.data ?? [];

  const refresh = () => {
    void utils.notification.unreadCount.invalidate();
    void utils.notification.list.invalidate();
  };

  const markRead = trpc.notification.markRead.useMutation({ onSuccess: refresh });
  const markAllRead = trpc.notification.markAllRead.useMutation({ onSuccess: refresh });
  const archive = trpc.notification.archive.useMutation({ onSuccess: refresh });

  const hasUnread = notifications.some((n) => !n.isRead);

  const open = (n: NotificationDto) => {
    if (!n.isRead) {
      markRead.mutate({ id: n.id });
    }
    // Prefer the event's own deep link (M11 announcements carry /announcements/:id);
    // fall back to the type default (M10).
    const href = (n.actionUrl as Href | null) ?? deepLinkForType(n.type);
    if (href) {
      router.push(href);
    }
  };

  return (
    <View className="flex-1 bg-neutral-50">
      <Header
        title={t.title}
        onBack={() => router.back()}
        action={
          hasUnread ? (
            <Button
              size="sm"
              variant="ghost"
              label={t.markAllRead}
              onPress={() => markAllRead.mutate()}
            />
          ) : undefined
        }
      />

      {list.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7A3414" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerClassName="p-4 gap-3"
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
          }
          ListEmptyComponent={<Text className="font-sans text-neutral-500">{t.empty}</Text>}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onOpen={() => open(item)}
              onArchive={() => archive.mutate({ id: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

function NotificationRow({
  item,
  onOpen,
  onArchive,
}: {
  item: NotificationDto;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const { dict } = useTranslation();
  return (
    <View
      className={`flex-row items-start gap-3 rounded-card border p-4 shadow-sm ${
        item.isRead ? "border-subtle bg-card" : "border-primary-100 bg-primary-50"
      }`}
    >
      <View className="mt-1.5 w-2">
        {!item.isRead ? <View className="size-2 rounded-full bg-primary-600" /> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onOpen} className="flex-1 gap-1">
        <Text
          className={`font-sans text-body ${
            item.isRead ? "text-neutral-800" : "font-semibold text-neutral-900"
          }`}
        >
          {item.title}
        </Text>
        <Text className="font-sans text-sm text-neutral-500">{item.body}</Text>
        <Text className="font-sans text-caption text-neutral-400">{timeAgo(item.createdAt)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dict.notifications.archive}
        onPress={onArchive}
        className="size-9 items-center justify-center rounded-xl active:bg-neutral-100"
      >
        <Archive size={17} color="#6E6052" weight="regular" />
      </Pressable>
    </View>
  );
}
