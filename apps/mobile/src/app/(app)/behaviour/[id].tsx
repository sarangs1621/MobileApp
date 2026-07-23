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
    <View className="flex-1 bg-neutral-50">
      <Header title="Incident" onBack={() => router.back()} />
      {incident.isLoading || !b ? (
        <Loading />
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-4">
          <View className="gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-display text-title text-neutral-900">{b.title}</Text>
              <SeverityText severity={b.severity} />
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-sans text-sm text-neutral-500">
                {CATEGORY_LABEL[b.category]}
              </Text>
              <StatusText status={b.status} />
            </View>
          </View>

          <Field label="Description">
            <Text className="font-sans text-body text-neutral-800">{b.description}</Text>
          </Field>

          {b.actionTaken ? (
            <Field label="Action taken">
              <Text className="font-sans text-body text-neutral-800">{b.actionTaken}</Text>
            </Field>
          ) : null}

          <Text className="font-sans text-caption text-neutral-400">
            {b.parentNotified ? "Parents were notified." : "Parents were not notified."}
          </Text>

          {canAct ? (
            <View className="gap-3">
              {b.status !== "RESOLVED" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => resolve.mutate({ id: b.id })}
                  className="min-h-12 items-center justify-center rounded-pill border border-strong bg-white px-4 active:bg-primary-50"
                >
                  <Text className="font-sans font-semibold text-primary-700">Mark resolved</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => close.mutate({ id: b.id })}
                className="min-h-12 items-center justify-center rounded-pill bg-primary-600 px-4 active:bg-primary-700"
              >
                <Text className="font-sans font-semibold text-neutral-50">Close incident</Text>
              </Pressable>
              <Text className="px-1 font-sans text-caption text-neutral-400">
                A closed incident can no longer be edited.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
