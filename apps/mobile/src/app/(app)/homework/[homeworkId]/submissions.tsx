import { useTranslation } from "@repo/i18n";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { ScreenScaffold } from "../../../../components/attendance-ui";
import { SUB_STATUS_CLASS, SUB_STATUS_LABEL } from "../../../../components/homework-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * Teacher review queue (M6): every submission for one homework, labelled by student
 * (resolved via the section roster, like mark entry). Tapping opens the submission
 * detail where the teacher returns/accepts it with feedback.
 */
export default function SubmissionsQueueScreen() {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const { homeworkId } = useLocalSearchParams<{ homeworkId: string }>();
  const id = homeworkId ?? "";

  const hw = trpc.homework.get.useQuery({ homeworkId: id }, { enabled: id !== "" });
  const subs = trpc.submission.listByHomework.useQuery({ homeworkId: id }, { enabled: id !== "" });
  const roster = trpc.enrollment.sectionRoster.useQuery(
    { academicYearId: hw.data?.academicYearId ?? "", sectionId: hw.data?.sectionId ?? "" },
    { enabled: hw.data !== undefined },
  );
  const students = trpc.student.list.useQuery();

  const studentName = new Map(
    (students.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );
  const enrollmentStudent = new Map((roster.data ?? []).map((e) => [e.id, e.studentId]));
  const nameOf = (enrollmentId: string): string => {
    const sid = enrollmentStudent.get(enrollmentId);
    return (sid ? studentName.get(sid) : undefined) ?? tr.student;
  };

  const rows = subs.data ?? [];

  return (
    <ScreenScaffold title={tr.submissions}>
      {subs.isLoading || hw.isLoading ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground">{tr.noSubmissions}</Text>
      ) : (
        rows.map((s) => (
          <Link
            key={s.id}
            href={{
              pathname: "/homework/submission/[submissionId]",
              params: { submissionId: s.id },
            }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="gap-1 rounded-md border border-border bg-card p-4"
            >
              <Text className="font-medium text-foreground">{nameOf(s.enrollmentId)}</Text>
              <Text className="text-sm text-muted-foreground">
                {tr.attempt(s.attempt)} ·{" "}
                <Text className={SUB_STATUS_CLASS[s.status]}>{SUB_STATUS_LABEL[s.status]}</Text>
                {s.isLate ? tr.lateSuffix : ""}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
