import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ListRow } from "../../../../components/academic-list";
import {
  monthStartIst,
  ScreenScaffold,
  STATUS_CLASS,
  STATUS_LABEL,
  todayIst,
} from "../../../../components/attendance-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * Attendance for one enrollment (this month): a summary header, then a
 * date-sorted "calendar" merging daily marks with holidays. Serves parents (own
 * child) and teachers (own section); the service enforces scope. Teachers who may
 * submit corrections get a per-record link to request one (ADR-011 §8).
 */
export default function EnrollmentAttendanceScreen() {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const { enrollmentId, academicYearId } = useLocalSearchParams<{
    enrollmentId: string;
    academicYearId?: string;
  }>();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canCorrect = role !== undefined && can(role, PERMISSIONS.ATTENDANCE_CORRECT_SUBMIT);

  const from = monthStartIst();
  const to = todayIst();
  const enabled = enrollmentId !== undefined;
  const range = { enrollmentId: enrollmentId ?? "", from, to };

  const summary = trpc.attendance.summary.useQuery(range, { enabled });
  const history = trpc.attendance.history.useQuery(range, { enabled });
  const holidays = trpc.holiday.list.useQuery(
    { academicYearId: academicYearId ?? "" },
    { enabled: academicYearId !== undefined },
  );

  const holidaysInRange = (holidays.data ?? []).filter((h) => h.date >= from && h.date <= to);
  type Row =
    | { kind: "record"; date: string; recordId: string; status: string }
    | { kind: "holiday"; date: string; name: string };
  const rows: Row[] = [
    ...(history.data ?? []).map((r): Row => ({
      kind: "record",
      date: r.date,
      recordId: r.id,
      status: r.status,
    })),
    ...holidaysInRange.map((h): Row => ({ kind: "holiday", date: h.date, name: h.name })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScreenScaffold title={t.attendance}>
      <Text className="font-sans text-sm text-neutral-500">
        {from} → {to}
      </Text>

      {summary.data ? (
        <ListRow>
          <Text className="font-display text-title text-neutral-900">
            {summary.data.percentage == null ? "—" : `${summary.data.percentage}%`}{" "}
            {t.presentSuffix}
          </Text>
          <Text className="font-sans text-sm text-neutral-500">
            {t.summaryBreakdown(
              summary.data.present,
              summary.data.absent,
              summary.data.late,
              summary.data.halfDay,
              summary.data.leave,
            )}
          </Text>
        </ListRow>
      ) : (
        <ActivityIndicator color="#7A3414" />
      )}

      <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
        {t.calendar}
      </Text>
      {history.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : rows.length === 0 ? (
        <Text className="font-sans text-sm text-neutral-500">{t.noRecords}</Text>
      ) : (
        rows.map((row) =>
          row.kind === "holiday" ? (
            <ListRow key={`h:${row.date}`}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-sans text-body font-semibold text-neutral-900">
                  {row.date}
                </Text>
                <Text className="font-sans text-sm text-info-600">{t.holiday(row.name)}</Text>
              </View>
            </ListRow>
          ) : (
            <ListRow key={row.recordId}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-sans text-body font-semibold text-neutral-900">
                  {row.date}
                </Text>
                <Text
                  className={`font-sans text-sm font-semibold ${STATUS_CLASS[row.status as keyof typeof STATUS_CLASS]}`}
                >
                  {STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]}
                </Text>
              </View>
              {canCorrect ? (
                <Link
                  href={{
                    pathname: "/attendance/correct/[recordId]",
                    params: { recordId: row.recordId },
                  }}
                  asChild
                >
                  <Pressable accessibilityRole="button">
                    <Text className="font-sans text-sm font-semibold text-primary-700">
                      {t.requestCorrection}
                    </Text>
                  </Pressable>
                </Link>
              ) : null}
            </ListRow>
          ),
        )
      )}
    </ScreenScaffold>
  );
}
