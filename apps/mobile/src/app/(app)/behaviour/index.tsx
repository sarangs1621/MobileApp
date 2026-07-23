import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import {
  CATEGORY_LABEL,
  Header,
  Loading,
  SeverityText,
  StatusText,
} from "../../../components/behaviour-ui";
import { trpc } from "../../../lib/trpc";

/**
 * A teacher's own behaviour referrals (M12 Step 6) — the incidents they raised
 * (teacherId = self). New incidents are recorded from a student's profile → Behaviour.
 */
export default function MyReferralsScreen() {
  const router = useRouter();
  const list = trpc.behaviour.listByTeacher.useQuery({});
  const rows = list.data ?? [];

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title="Behaviour referrals" onBack={() => router.back()} />
      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerClassName="p-4 gap-3"
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
          }
          ListEmptyComponent={
            <Text className="font-sans text-neutral-500">
              You have no referrals. Open a student’s profile to record one.
            </Text>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: "/behaviour/[id]", params: { id: item.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                className="gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                    {item.title}
                  </Text>
                  <SeverityText severity={item.severity} />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-sans text-caption text-neutral-500">
                    {CATEGORY_LABEL[item.category]}
                  </Text>
                  <StatusText status={item.status} />
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
