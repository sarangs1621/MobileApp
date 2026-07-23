import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import { Plus } from "phosphor-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { HW_STATUS_LABEL } from "../../../components/homework-ui";
import { StatusChip } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Homework list (M6, mobile), role-aware:
 * - teacher → own (subject × section) homework, all states, with a "New" action;
 * - parent → PUBLISHED/CLOSED homework for their children (§10 or-clause).
 * Tapping opens the detail (lifecycle actions / submission) screen.
 */
export default function HomeworkListScreen() {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const me = trpc.auth.me.useQuery();
  const isParent = me.data?.role === "PARENT";

  const homework = trpc.homework.list.useQuery({});
  const targets = trpc.homework.targets.useQuery(undefined, { enabled: !isParent });
  const label = new Map(
    (targets.data ?? []).map((t) => [
      `${t.subjectId}:${t.sectionId}`,
      `${t.subjectName} · ${t.sectionName}`,
    ]),
  );

  const rows = homework.data ?? [];

  return (
    <ScreenScaffold title={tr.title}>
      {!isParent ? (
        <Link href="/homework/new" asChild>
          <Pressable
            accessibilityRole="button"
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-pill bg-primary-600 px-5 active:bg-primary-700"
          >
            <Plus size={18} color="#FCF9F3" weight="bold" />
            <Text className="font-sans font-semibold text-neutral-50">{tr.newHomework}</Text>
          </Pressable>
        </Link>
      ) : null}

      {homework.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">
          {isParent ? tr.noHomeworkParent : tr.noHomework}
        </Text>
      ) : (
        rows.map((h) => (
          <Link
            key={h.id}
            href={{ pathname: "/homework/[homeworkId]", params: { homeworkId: h.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
            >
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                  {h.title}
                </Text>
                <StatusChip status={h.status} label={HW_STATUS_LABEL[h.status]} dot />
              </View>
              <Text className="font-sans text-sm text-neutral-500">
                {isParent
                  ? `${tr.due} ${h.dueDate}`
                  : `${label.get(`${h.subjectId}:${h.sectionId}`) ?? "—"} · ${tr.due} ${h.dueDate}`}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
