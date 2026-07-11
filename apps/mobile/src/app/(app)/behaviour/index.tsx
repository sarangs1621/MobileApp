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
    <View className="flex-1 bg-background">
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
            <Text className="text-muted-foreground">
              You have no referrals. Open a student’s profile to record one.
            </Text>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: "/behaviour/[id]", params: { id: item.id } }} asChild>
              <Pressable
                accessibilityRole="button"
                className="gap-1 rounded-md border border-border bg-card p-4"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-medium text-foreground">{item.title}</Text>
                  <SeverityText severity={item.severity} />
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-xs text-muted-foreground">
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
