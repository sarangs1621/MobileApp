import { useTranslation } from "@repo/i18n";
import type { ReportCardDto, ReportCardKindKey } from "@repo/types";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

const KIND_LABEL: Record<ReportCardKindKey, string> = {
  EXAM: "Exam report card",
  TERM: "Term report card",
  ANNUAL: "Annual report card",
};

/**
 * A child's PUBLISHED report cards for the current (ACTIVE) enrollment (M7, parent).
 * The service returns PUBLISHED-only for a parent; snapshot fields (rank, attendance %,
 * GPA) render without a PDF. Read-only.
 *
 * ponytail: current-year cards only — cross-year trail (Q6) needs a listForStudent
 * endpoint that does not exist yet; add it when the year-over-year view is built.
 */
export default function StudentReportCardsScreen() {
  const { dict } = useTranslation();
  const t = dict.reportCards;
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const enabled = studentId !== undefined && studentId !== "";
  const enrollments = trpc.enrollment.listByStudent.useQuery(
    { studentId: studentId ?? "" },
    { enabled },
  );
  const active = (enrollments.data ?? []).find((e) => e.status === "ACTIVE");

  const cards = trpc.reportCard.listForEnrollment.useQuery(
    { enrollmentId: active?.id ?? "" },
    { enabled: active != null },
  );

  if (enrollments.isLoading) {
    return (
      <ScreenScaffold title={t.title}>
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }
  if (active == null) {
    return (
      <ScreenScaffold title={t.title}>
        <Text className="font-sans text-neutral-500">{t.noCurrentEnrollment}</Text>
      </ScreenScaffold>
    );
  }

  const rows = cards.data ?? [];
  return (
    <ScreenScaffold title={t.title}>
      {cards.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">{t.noPublished}</Text>
      ) : (
        rows.map((c) => <ReportCardView key={c.id} card={c} />)
      )}
    </ScreenScaffold>
  );
}

function ReportCardView({ card }: { card: ReportCardDto }) {
  const { dict } = useTranslation();
  const t = dict.reportCards;
  const rank =
    card.rank != null && card.cohortSize != null ? t.rankOf(card.rank, card.cohortSize) : "—";
  const attendance = card.attendancePercentage != null ? `${card.attendancePercentage}%` : "—";
  const gpa = card.gpaSnapshot != null ? card.gpaSnapshot.toFixed(2) : t.notAvailable;

  const scopeName = card.examName ?? card.termName; // null for ANNUAL (no exam/term scope)

  return (
    <View className="gap-3 rounded-card border border-subtle bg-card p-4 shadow-sm">
      <View>
        <Text className="font-display text-title text-neutral-900">{KIND_LABEL[card.kind]}</Text>
        {scopeName ? <Text className="font-sans text-sm text-neutral-500">{scopeName}</Text> : null}
      </View>
      <View className="flex-row flex-wrap gap-x-6 gap-y-2">
        <Stat label={t.rank} value={rank} />
        <Stat label={t.attendance} value={attendance} />
        <Stat label={t.gpa} value={gpa} />
        {card.promotionDecision ? <Stat label={t.result} value={card.promotionDecision} /> : null}
      </View>
      {card.classTeacherRemark ? (
        <Remark
          label={
            card.classTeacherName ? t.classTeacherWithName(card.classTeacherName) : t.classTeacher
          }
          body={card.classTeacherRemark}
        />
      ) : null}
      {card.principalRemark ? <Remark label={t.principal} body={card.principalRemark} /> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
        {label}
      </Text>
      <Text className="font-display text-title text-neutral-900">{value}</Text>
    </View>
  );
}

function Remark({ label, body }: { label: string; body: string }) {
  const { dict } = useTranslation();
  return (
    <View className="gap-0.5 border-t border-subtle pt-2">
      <Text className="font-sans text-caption font-semibold text-neutral-500">
        {label} {dict.reportCards.remarkSuffix}
      </Text>
      <Text className="font-sans text-sm text-neutral-800">{body}</Text>
    </View>
  );
}
