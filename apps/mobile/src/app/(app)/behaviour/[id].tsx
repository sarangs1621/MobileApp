import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  CATEGORY_LABEL,
  Field,
  Header,
  Loading,
  SeverityText,
  StatusText,
} from "../../../components/behaviour-ui";
import { trpc } from "../../../lib/trpc";

/**
 * Behaviour incident detail (M12 Step 6) — the deep-link target for a BEHAVIOUR
 * notification (actionUrl=/behaviour/:id). Shows the incident; the owning teacher
 * (teacherId = self) or an admin can resolve/close it while it is not yet CLOSED.
 */
export default function BehaviourDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const enabled = !!id;
  const utils = trpc.useUtils();

  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.BEHAVIOUR_MANAGE);

  const incident = trpc.behaviour.get.useQuery({ id: id ?? "" }, { enabled });
  const b = incident.data;

  const refresh = () => {
    void utils.behaviour.get.invalidate({ id });
    if (b) void utils.behaviour.listByStudent.invalidate({ studentId: b.studentId });
  };
  const resolve = trpc.behaviour.resolve.useMutation({ onSuccess: refresh });
  const close = trpc.behaviour.close.useMutation({ onSuccess: refresh });

  const isOwner = !!b && !!me.data && b.teacherId === me.data.userId;
  const canAct = (canManage || isOwner) && !!b && b.status !== "CLOSED";
  const busy = resolve.isPending || close.isPending;

  return (
    <View className="flex-1 bg-background">
      <Header title="Incident" onBack={() => router.back()} />
      {incident.isLoading || !b ? (
        <Loading />
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-4">
          <View className="gap-2 rounded-md border border-border bg-card p-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-lg font-semibold text-foreground">{b.title}</Text>
              <SeverityText severity={b.severity} />
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-sm text-muted-foreground">{CATEGORY_LABEL[b.category]}</Text>
              <StatusText status={b.status} />
            </View>
          </View>

          <Field label="Description">
            <Text className="text-foreground">{b.description}</Text>
          </Field>

          {b.actionTaken ? (
            <Field label="Action taken">
              <Text className="text-foreground">{b.actionTaken}</Text>
            </Field>
          ) : null}

          <Text className="text-xs text-muted-foreground">
            {b.parentNotified ? "Parents were notified." : "Parents were not notified."}
          </Text>

          {canAct ? (
            <View className="gap-3">
              {b.status !== "RESOLVED" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => resolve.mutate({ id: b.id })}
                  className="min-h-11 items-center justify-center rounded-md border border-border px-4 py-3"
                >
                  <Text className="font-medium text-foreground">Mark resolved</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => close.mutate({ id: b.id })}
                className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
              >
                <Text className="font-medium text-primary-foreground">Close incident</Text>
              </Pressable>
              <Text className="px-1 text-xs text-muted-foreground">
                A closed incident can no longer be edited.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
