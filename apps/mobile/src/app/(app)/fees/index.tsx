import { useTranslation } from "@repo/i18n";
import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { Header, Loading } from "../../../components/behaviour-ui";
import { trpc } from "../../../lib/trpc";

/**
 * Fees entry point (M13 Step 6). Pick a student to open their fee ledger. The
 * `student.list` query is already role-scoped — a parent sees only their children,
 * an admin sees the school's students (for quick payment entry).
 */
export default function FeesHomeScreen() {
  const { dict } = useTranslation();
  const t = dict.fees;
  const router = useRouter();
  const students = trpc.student.list.useQuery();
  const rows = students.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <Header title={t.title} onBack={() => router.back()} />
      {students.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          contentContainerClassName="p-4 gap-3"
          ListEmptyComponent={<Text className="text-muted-foreground">{t.noStudents}</Text>}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: "/fees/student/[studentId]", params: { studentId: item.id } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                className="gap-1 rounded-md border border-border bg-card p-4"
              >
                <Text className="font-medium text-foreground">
                  {item.firstName} {item.lastName}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {t.admission} {item.admissionNo}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
