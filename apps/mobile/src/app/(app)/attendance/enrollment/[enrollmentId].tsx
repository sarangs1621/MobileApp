import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";

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
    ...(history.data ?? []).map(
      (r): Row => ({ kind: "record", date: r.date, recordId: r.id, status: r.status }),
    ),
    ...holidaysInRange.map((h): Row => ({ kind: "holiday", date: h.date, name: h.name })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScreenScaffold title="Attendance">
      <Text className="text-sm text-muted-foreground">
        {from} → {to}
      </Text>

      {summary.data ? (
        <ListRow>
          <Text className="font-medium text-foreground">
            {summary.data.percentage == null ? "—" : `${summary.data.percentage}%`} present
          </Text>
          <Text className="text-sm text-muted-foreground">
            {summary.data.present} present · {summary.data.absent} absent · {summary.data.late} late ·{" "}
            {summary.data.halfDay} half · {summary.data.leave} leave
          </Text>
        </ListRow>
      ) : (
        <ActivityIndicator />
      )}

      <Text className="text-sm font-medium text-muted-foreground">Calendar</Text>
      {history.isLoading ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No records this month.</Text>
      ) : (
        rows.map((row) =>
          row.kind === "holiday" ? (
            <ListRow key={`h:${row.date}`}>
              <Text className="font-medium text-foreground">{row.date}</Text>
              <Text className="text-sm text-info">Holiday · {row.name}</Text>
            </ListRow>
          ) : (
            <ListRow key={row.recordId}>
              <Text className="font-medium text-foreground">{row.date}</Text>
              <Text
                className={`text-sm font-medium ${STATUS_CLASS[row.status as keyof typeof STATUS_CLASS]}`}
              >
                {STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]}
              </Text>
              {canCorrect ? (
                <Link
                  href={{ pathname: "/attendance/correct/[recordId]", params: { recordId: row.recordId } }}
                  asChild
                >
                  <Pressable accessibilityRole="button">
                    <Text className="text-sm text-primary">Request correction</Text>
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
