import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

/**
 * Teacher "assessment list" (M5, mobile): the (assessment × section) targets the
 * teacher may mark in the active year, with each register's status. Tapping one
 * opens mark entry. Admins have no assignments → empty (they manage on web).
 */
export default function MarkableAssessmentsScreen() {
  const markable = trpc.mark.markable.useQuery();
  const rows = markable.data ?? [];

  return (
    <ScreenScaffold title="Enter marks">
      {markable.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">
          No assessments are assigned to you in the active year yet.
        </Text>
      ) : (
        rows.map((a) => (
          <Link
            key={`${a.assessmentId}:${a.sectionId}`}
            href={{
              pathname: "/exam/mark/[assessmentId]",
              params: { assessmentId: a.assessmentId, sectionId: a.sectionId },
            }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm active:bg-neutral-50"
            >
              <Text className="font-sans text-body font-semibold text-neutral-900">
                {a.examName} · {a.subjectName}
              </Text>
              <Text className="font-sans text-sm text-neutral-500">
                Section {a.sectionName} ·{" "}
                {a.registerStatus === "NONE" ? "Not started" : a.registerStatus}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
