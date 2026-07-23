import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HubHeader, NavCard, NavLink } from "../../../components/nav-menu";
import { trpc } from "../../../lib/trpc";

/**
 * Alerts & approvals tab (admin). Notifications plus the approval queues the
 * office acts on — leave requests and attendance corrections.
 */
export default function AlertsTab() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;
  const has = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    role !== undefined && can(role, p);

  const unread =
    trpc.notification.unreadCount.useQuery(undefined, {
      refetchInterval: 30_000,
      retry: false,
    }).data ?? 0;

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.alerts} />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <NavCard title={dict.tabs.alerts}>
          <NavLink
            href="/notifications"
            label={
              unread > 0 ? `${dict.notifications.title} (${unread})` : dict.notifications.title
            }
          />
        </NavCard>

        {has(PERMISSIONS.LEAVE_DECIDE) || has(PERMISSIONS.ATTENDANCE_CORRECT_DECIDE) ? (
          <NavCard title={t.attendance}>
            {has(PERMISSIONS.LEAVE_DECIDE) ? (
              <NavLink href="/attendance/leave" label={t.leaveRequests} />
            ) : null}
            {has(PERMISSIONS.ATTENDANCE_CORRECT_DECIDE) ? (
              <NavLink href="/attendance/my-corrections" label={t.myCorrections} />
            ) : null}
          </NavCard>
        ) : null}
      </ScrollView>
    </View>
  );
}
