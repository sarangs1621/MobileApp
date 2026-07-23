import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Loading } from "../../../components/behaviour-ui";
import { formatPaise } from "../../../components/fees-ui";
import { HubHeader } from "../../../components/nav-menu";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Fees tab (parent + office). Pick a student to open their fee ledger; the
 * `student.list` query is role-scoped (a parent sees only their children). Parents
 * also get an outstanding-balance summary up top, from the analytics query. This
 * replaces the old `(app)/fees/index.tsx` entry — it now lives in the tab bar.
 */
export default function FeesTab() {
  const { dict } = useTranslation();
  const t = dict.fees;
  const insets = useSafeAreaInsets();
  const students = trpc.student.list.useQuery();
  const overview = trpc.analytics.dashboard.useQuery(undefined);
  const rows = students.data ?? [];

  const duesCards =
    overview.data?.role === "PARENT" ? (
      <View className="gap-3 pb-1">
        {overview.data.children.map((child) => (
          <View
            key={child.studentId}
            className="gap-1 rounded-card border border-subtle bg-primary-900 p-5 shadow-sm"
          >
            <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-gold-400">
              {dict.home.dues}
            </Text>
            <Text className="font-display text-display text-neutral-50">
              {formatPaise(child.dues)}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.fees} />
      {students.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          contentContainerClassName="p-4 gap-3"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={duesCards}
          ListEmptyComponent={<Text className="font-sans text-neutral-500">{t.noStudents}</Text>}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: "/fees/student/[studentId]", params: { studentId: item.id } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
              >
                <Avatar name={`${item.firstName} ${item.lastName}`} />
                <View className="flex-1">
                  <Text className="font-sans text-body font-semibold text-neutral-900">
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text className="font-sans text-sm text-neutral-500">
                    {t.admission} {item.admissionNo}
                  </Text>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
