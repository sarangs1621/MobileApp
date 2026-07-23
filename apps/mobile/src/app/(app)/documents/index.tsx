import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { Header, Loading } from "../../../components/behaviour-ui";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Documents entry point (M15 Step 6). Pick a student to open their document center.
 * `student.list` is role-scoped — a parent sees only their children, teacher/admin the
 * school's students. Parents download; teachers view; admins generate/approve/archive.
 */
export default function DocumentsHomeScreen() {
  const router = useRouter();
  const students = trpc.student.list.useQuery();
  const rows = students.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <Header title="Documents" onBack={() => router.back()} />
      {students.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          contentContainerClassName="p-4 gap-3"
          ListEmptyComponent={
            <Text className="font-sans text-neutral-500">No students found.</Text>
          }
          renderItem={({ item }) => (
            <Link
              href={{ pathname: "/documents/student/[studentId]", params: { studentId: item.id } }}
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
                    Admission {item.admissionNo}
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
