import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { ScreenScaffold } from "../../../../components/attendance-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * A child's PUBLISHED results (M5, parent). Resolves the current (ACTIVE)
 * enrollment, then shows only published+locked marks (the service enforces this —
 * the parent never sees a partial/in-flight result) with grade + the overall GPA.
 * Read-only; no report card (later milestone).
 */
export default function ResultsScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const enabled = studentId !== undefined && studentId !== "";
  const enrollments = trpc.enrollment.listByStudent.useQuery(
    { studentId: studentId ?? "" },
    { enabled },
  );
  const active = (enrollments.data ?? []).find((e) => e.status === "ACTIVE");

  const marks = trpc.mark.listByEnrollment.useQuery(
    { enrollmentId: active?.id ?? "" },
    { enabled: active != null },
  );
  const gpa = trpc.mark.gpa.useQuery(
    { enrollmentId: active?.id ?? "" },
    { enabled: active != null },
  );

  if (enrollments.isLoading) {
    return (
      <ScreenScaffold title="Results">
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }
  if (active == null) {
    return (
      <ScreenScaffold title="Results">
        <Text className="font-sans text-neutral-500">No current enrollment for this student.</Text>
      </ScreenScaffold>
    );
  }

  const rows = marks.data ?? [];
  return (
    <ScreenScaffold title="Results">
      <View className="rounded-card border border-subtle bg-card p-4 shadow-sm">
        <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
          Overall GPA
        </Text>
        <Text className="font-display text-display text-neutral-900">
          {typeof gpa.data === "number" ? gpa.data.toFixed(2) : "Not available"}
        </Text>
      </View>

      {marks.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">No published results yet.</Text>
      ) : (
        rows.map((m) => (
          <View
            key={m.id}
            className="gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm"
          >
            <Text className="font-sans text-body font-semibold text-neutral-900">
              {m.examName ?? "Exam"} · {m.subjectName ?? "Subject"}
            </Text>
            <Text className="font-sans text-sm text-neutral-500">
              {m.isAbsent
                ? "Absent"
                : `${m.totalObtained ?? "—"} marks · ${m.percentage != null ? `${m.percentage}%` : "—"} · Grade ${m.gradeLetter ?? "—"}`}
            </Text>
          </View>
        ))
      )}
    </ScreenScaffold>
  );
}
