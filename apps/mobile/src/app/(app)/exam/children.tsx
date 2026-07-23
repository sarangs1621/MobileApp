import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/** Parent "Marks & grades": pick a child to view their published results (M5). */
export default function ChildrenResultsScreen() {
  const children = trpc.student.list.useQuery();
  const rows = children.data ?? [];

  return (
    <ScreenScaffold title="Marks & grades">
      {children.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">No children are linked to your account.</Text>
      ) : (
        rows.map((s) => (
          <Link
            key={s.id}
            href={{ pathname: "/exam/results/[studentId]", params: { studentId: s.id } }}
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
                  Admission {s.admissionNo}
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
