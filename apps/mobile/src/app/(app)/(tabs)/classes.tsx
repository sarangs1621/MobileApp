import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HubHeader, NavCard, NavLink } from "../../../components/nav-menu";
import { trpc } from "../../../lib/trpc";

/**
 * Classes tab (teacher). Lists the teacher's assigned sections and the class
 * workflows — mark attendance, set homework, enter marks, record behaviour.
 */
export default function ClassesTab() {
  const { dict } = useTranslation();
  const t = dict.home;
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;
  const has = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    role !== undefined && can(role, p);

  const teaching = trpc.homework.targets.useQuery(undefined, { enabled: role === "TEACHER" });
  const mySections = [...new Set((teaching.data ?? []).map((r) => r.sectionName))];

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.classes} />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {mySections.length > 0 ? (
          <View className="gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm">
            <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
              {t.yourSections}
            </Text>
            <Text className="font-sans text-foreground">{mySections.join(" · ")}</Text>
          </View>
        ) : null}

        <NavCard title={t.classes}>
          {has(PERMISSIONS.ATTENDANCE_MARK) ? (
            <NavLink href="/attendance/sections" label={t.markAttendance} />
          ) : null}
          {has(PERMISSIONS.HOMEWORK_MANAGE) ? (
            <NavLink href="/homework" label={t.homework} />
          ) : null}
          {has(PERMISSIONS.MARK_ENTER) ? (
            <NavLink href="/exam/markable" label={t.enterMarks} />
          ) : null}
          {has(PERMISSIONS.BEHAVIOUR_RECORD) || has(PERMISSIONS.BEHAVIOUR_MANAGE) ? (
            <NavLink href="/behaviour" label={t.myBehaviourReferrals} />
          ) : null}
        </NavCard>
      </ScrollView>
    </View>
  );
}
