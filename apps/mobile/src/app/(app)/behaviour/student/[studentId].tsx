import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import {
  CATEGORY_LABEL,
  Header,
  Loading,
  SeverityText,
  StatusText,
} from "../../../../components/behaviour-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * A student's discipline history (M12, ADR-020 Step 6). Shared by teacher (from the
 * student profile) and parent (from their child). The service scopes the rows (admin
 * all; teacher own-section; parent own-child). Teachers/admins get a "New incident" CTA.
 */
export default function StudentBehaviourScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const enabled = !!studentId;

  const role = trpc.auth.me.useQuery().data?.role;
  const canRecord =
    role !== undefined &&
    (can(role, PERMISSIONS.BEHAVIOUR_RECORD) || can(role, PERMISSIONS.BEHAVIOUR_MANAGE));

  const list = trpc.behaviour.listByStudent.useQuery({ studentId: studentId ?? "" }, { enabled });
  const rows = list.data ?? [];

  return (
    <View className="flex-1 bg-background">
      <Header title="Behaviour" onBack={() => router.back()} />

      {canRecord ? (
        <View className="border-b border-border p-4">
          <Link
            href={{ pathname: "/behaviour/new", params: { studentId: studentId ?? "" } }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
            >
              <Text className="font-medium text-primary-foreground">Record an incident</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

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
            <Text className="text-muted-foreground">No behaviour incidents recorded.</Text>
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
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {item.description}
                </Text>
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
