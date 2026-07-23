import { Link, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Header, Loading } from "../../../components/behaviour-ui";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/** Parent "Behaviour": pick a child to view their discipline history (M12 Step 6). */
export default function BehaviourChildrenScreen() {
  const router = useRouter();
  const children = trpc.student.list.useQuery();
  const rows = children.data ?? [];

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title="Behaviour" onBack={() => router.back()} />
      <View className="gap-3 p-4">
        {children.isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Text className="font-sans text-neutral-500">
            No children are linked to your account.
          </Text>
        ) : (
          rows.map((s) => (
            <Link
              key={s.id}
              href={{ pathname: "/behaviour/student/[studentId]", params: { studentId: s.id } }}
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
      </View>
    </View>
  );
}
