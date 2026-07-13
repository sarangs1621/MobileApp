import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { HW_STATUS_LABEL } from "../../../components/homework-ui";
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
            className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
          >
            <Text className="font-medium text-primary-foreground">{tr.newHomework}</Text>
          </Pressable>
        </Link>
      ) : null}

      {homework.isLoading ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground">
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
              className="gap-1 rounded-md border border-border bg-card p-4"
            >
              <Text className="font-medium text-foreground">{h.title}</Text>
              <Text className="text-sm text-muted-foreground">
                {isParent
                  ? `${tr.due} ${h.dueDate} · ${HW_STATUS_LABEL[h.status]}`
                  : `${label.get(`${h.subjectId}:${h.sectionId}`) ?? "—"} · ${tr.due} ${h.dueDate} · ${HW_STATUS_LABEL[h.status]}`}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
