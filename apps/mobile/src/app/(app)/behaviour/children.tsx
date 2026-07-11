import { Link, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Header, Loading } from "../../../components/behaviour-ui";
import { trpc } from "../../../lib/trpc";

/** Parent "Behaviour": pick a child to view their discipline history (M12 Step 6). */
export default function BehaviourChildrenScreen() {
  const router = useRouter();
  const children = trpc.student.list.useQuery();
  const rows = children.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <Header title="Behaviour" onBack={() => router.back()} />
      <View className="p-4 gap-3">
        {children.isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Text className="text-muted-foreground">No children are linked to your account.</Text>
        ) : (
          rows.map((s) => (
            <Link
              key={s.id}
              href={{ pathname: "/behaviour/student/[studentId]", params: { studentId: s.id } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                className="gap-1 rounded-md border border-border bg-card p-4"
              >
                <Text className="font-medium text-foreground">
                  {s.firstName} {s.lastName}
                </Text>
                <Text className="text-sm text-muted-foreground">Admission {s.admissionNo}</Text>
              </Pressable>
            </Link>
          ))
        )}
      </View>
    </View>
  );
}
