import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/** Parent "Report cards": pick a child to view their PUBLISHED report cards (M7). */
export default function ChildrenReportCardsScreen() {
  const { dict } = useTranslation();
  const t = dict.reportCards;
  const children = trpc.student.list.useQuery();
  const rows = children.data ?? [];

  return (
    <ScreenScaffold title={t.title}>
      {children.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">{t.noChildrenLinked}</Text>
      ) : (
        rows.map((s) => (
          <Link
            key={s.id}
            href={{ pathname: "/report-cards/[studentId]", params: { studentId: s.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
            >
              <Avatar name={`${s.firstName} ${s.lastName}`} />
              <View className="flex-1">
                <Text className="font-sans text-body font-semibold text-neutral-900">
                  {s.firstName} {s.lastName}
                </Text>
                <Text className="font-sans text-sm text-neutral-500">
                  {t.admission} {s.admissionNo}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
