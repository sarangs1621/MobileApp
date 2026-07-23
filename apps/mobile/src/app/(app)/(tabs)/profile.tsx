import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { UserCircle } from "phosphor-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HubHeader, LogoutRow, NavCard, NavLink } from "../../../components/nav-menu";
import { trpc } from "../../../lib/trpc";

/** Admin "Profile" tab — the staff account, settings/preferences, and sign-out. */
export default function ProfileTab() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const roleLabel = role ? role.replace("_", " ").toLowerCase() : "";
  const canManageSettings = role !== undefined && can(role, PERMISSIONS.SETTINGS_MANAGE);

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.profile} />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-row items-center gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm">
          <View className="size-12 items-center justify-center rounded-full bg-primary-700">
            <UserCircle size={26} color="#FCF9F3" weight="fill" />
          </View>
          <View className="flex-1">
            <Text className="font-display text-title text-neutral-900" numberOfLines={1}>
              {t.signedIn}
            </Text>
            {roleLabel ? (
              <Text className="font-sans text-caption capitalize text-neutral-500">
                {roleLabel}
              </Text>
            ) : null}
          </View>
        </View>

        <NavCard title={t.settings}>
          <NavLink
            href="/settings"
            label={canManageSettings ? t.schoolConfiguration : t.preferences}
          />
          <NavLink href="/notifications" label={dict.notifications.title} />
        </NavCard>

        <LogoutRow />
      </ScrollView>
    </View>
  );
}
