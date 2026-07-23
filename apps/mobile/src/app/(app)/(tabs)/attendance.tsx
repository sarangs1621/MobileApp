import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { monthStartIst, STATUS_LABEL, todayIst } from "../../../components/attendance-ui";
import { ChildSwitcher } from "../../../components/child-switcher";
import { HubHeader, NavCard, NavLink } from "../../../components/nav-menu";
import { trpc } from "../../../lib/trpc";

/**
 * Attendance tab. Parents see their child's month at a glance — a progress ring,
 * a present/absent/late breakdown and a colour-coded calendar (design handoff).
 * Teachers/office get the marking register and correction queue.
 */
export default function AttendanceTab() {
  const { dict } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = trpc.auth.me.useQuery().data?.role;
  const isParent = role === "PARENT";
  const has = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    role !== undefined && can(role, p);

  return (
    <View className="flex-1 bg-neutral-50">
      <HubHeader title={dict.tabs.attendance} />
      <ScrollView
        contentContainerClassName="p-4 gap-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {isParent ? <ParentAttendance /> : null}

        {has(PERMISSIONS.ATTENDANCE_MARK) || has(PERMISSIONS.ATTENDANCE_CORRECT_SUBMIT) ? (
          <NavCard title={dict.home.attendance}>
            {has(PERMISSIONS.ATTENDANCE_MARK) ? (
              <NavLink href="/attendance/sections" label={dict.home.markAttendance} />
            ) : null}
            {has(PERMISSIONS.ATTENDANCE_CORRECT_SUBMIT) ? (
              <NavLink href="/attendance/my-corrections" label={dict.home.myCorrections} />
            ) : null}
          </NavCard>
        ) : null}

        {has(PERMISSIONS.LEAVE_APPLY) ? (
          <NavCard title={dict.home.attendance}>
            <NavLink href="/attendance/leave" label={dict.home.leaveRequests} />
          </NavCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** The first child's month: ring + breakdown + calendar (from attendance.summary/history). */
function ParentAttendance() {
  const { dict } = useTranslation();
  const students = trpc.student.list.useQuery();
  const kids = (students.data ?? []).map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? kids[0]?.id ?? null;

  const enrollments = trpc.enrollment.listByStudent.useQuery(
    { studentId: activeId ?? "" },
    { enabled: !!activeId },
  );
  const enrollmentId = (enrollments.data ?? []).find((e) => e.status === "ACTIVE")?.id;
  const range = { enrollmentId: enrollmentId ?? "", from: monthStartIst(), to: todayIst() };
  const enabled = !!enrollmentId;

  const summary = trpc.attendance.summary.useQuery(range, { enabled });
  const history = trpc.attendance.history.useQuery(range, { enabled });

  if (!students.isLoading && !activeId) {
    return <Text className="font-sans text-sm text-neutral-500">{dict.home.noChildrenLinked}</Text>;
  }

  const s = summary.data;
  const statusByDate = new Map((history.data ?? []).map((r) => [r.date, r.status]));

  return (
    <>
      {activeId ? (
        <ChildSwitcher students={kids} selected={activeId} onSelect={setSelectedId} />
      ) : null}

      {summary.isLoading || !s ? (
        <ActivityIndicator color="#7A3414" />
      ) : (
        <>
          <View className="flex-row items-center gap-4 rounded-card border border-subtle bg-card p-4 shadow-sm">
            <Ring pct={s.percentage ?? 0} />
            <View className="flex-1 gap-2">
              <BreakdownRow color="#2F7A46" label={STATUS_LABEL.PRESENT} value={s.present} />
              <BreakdownRow color="#B23A28" label={STATUS_LABEL.ABSENT} value={s.absent} />
              <BreakdownRow color="#C29A45" label={STATUS_LABEL.LATE} value={s.late} />
            </View>
          </View>

          <Text className="font-display text-title text-neutral-900">
            {dict.attendance.calendar}
          </Text>
          <MonthCalendar statusByDate={statusByDate} />
        </>
      )}
    </>
  );
}

/** SVG progress ring (present %) — react-native-svg, no chart lib. */
function Ring({ pct }: { pct: number }) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * circ;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#F6F1E7"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#2F7A46"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text className="font-display text-xl text-neutral-900">{Math.round(clamped)}%</Text>
    </View>
  );
}

function BreakdownRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="font-sans text-sm text-neutral-700">{label}</Text>
      <Text className="ml-auto font-sans text-sm font-semibold text-neutral-900">{value}</Text>
    </View>
  );
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_TINT: Record<string, string> = {
  PRESENT: "bg-success-100",
  ABSENT: "bg-danger-100",
  LATE: "bg-gold-100",
  HALF_DAY: "bg-gold-100",
  LEAVE: "bg-gold-100",
};
const DAY_TEXT: Record<string, string> = {
  PRESENT: "text-success-600",
  ABSENT: "text-danger-600",
  LATE: "text-gold-700",
  HALF_DAY: "text-gold-700",
  LEAVE: "text-gold-700",
};

/** Current-month grid, each day tinted by its attendance status. */
function MonthCalendar({ statusByDate }: { statusByDate: Map<string, string> }) {
  const [y, m] = todayIst().split("-").map(Number) as [number, number];
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View className="rounded-card border border-subtle bg-card p-3 shadow-sm">
      <View className="flex-row">
        {DOW.map((d, i) => (
          <Text
            key={i}
            className="flex-1 text-center font-sans text-[10px] font-bold text-neutral-400"
          >
            {d}
          </Text>
        ))}
      </View>
      <View className="mt-1 flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day === null)
            return <View key={i} style={{ width: `${100 / 7}%` }} className="p-0.5" />;
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const status = statusByDate.get(dateStr);
          const tint = status ? DAY_TINT[status] : "";
          const text = status ? DAY_TEXT[status] : "text-neutral-400";
          return (
            <View key={i} style={{ width: `${100 / 7}%` }} className="p-0.5">
              <View className={`aspect-square items-center justify-center rounded-lg ${tint}`}>
                <Text className={`font-sans text-[11px] font-semibold ${text}`}>{day}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
