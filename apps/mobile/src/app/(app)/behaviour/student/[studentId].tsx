import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const enabled = !!studentId;

  const role = trpc.auth.me.useQuery().data?.role;
  const canRecord =
    role !== undefined &&
    (can(role, PERMISSIONS.BEHAVIOUR_RECORD) || can(role, PERMISSIONS.BEHAVIOUR_MANAGE));

  const list = trpc.behaviour.listByStudent.useQuery({ studentId: studentId ?? "" }, { enabled });
  const rows = list.data ?? [];

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title="Behaviour" onBack={() => router.back()} />

      {canRecord ? (
        <View className="border-b border-subtle bg-white p-4">
          <Link
            href={{ pathname: "/behaviour/new", params: { studentId: studentId ?? "" } }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="min-h-12 items-center justify-center rounded-pill bg-primary-600 px-4 active:bg-primary-700"
            >
              <Text className="font-sans font-semibold text-neutral-50">Record an incident</Text>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
          }
          ListEmptyComponent={
            <Text className="font-sans text-neutral-500">No behaviour incidents recorded.</Text>
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
                <Text className="font-sans text-sm text-neutral-500" numberOfLines={2}>
                  {item.description}
                </Text>
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
