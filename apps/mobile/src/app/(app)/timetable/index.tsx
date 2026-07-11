import type { TimetableEntryDto, WeekdayKey } from "@repo/types";
import { ActivityIndicator, Text, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

const WEEKDAY_ORDER: readonly WeekdayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

/**
 * Read-only weekly timetable (M9). Teacher → own slots (`timetable.byTeacher`);
 * parent → child's section grid (`timetable.forParent`). Both consume the enriched
 * `TimetableEntryDto` (subject/teacher/section names + period timing joined
 * server-side, ADR-016) — no id lookups here. Grouped by weekday (server already
 * sorts by weekday, then period order).
 */
export default function TimetableScreen() {
  const role = trpc.auth.me.useQuery().data?.role;
  const isParent = role === "PARENT";

  const teacher = trpc.timetable.byTeacher.useQuery({}, { enabled: role === "TEACHER" });
  const parent = trpc.timetable.forParent.useQuery({}, { enabled: isParent });
  const query = isParent ? parent : teacher;
  const entries = query.data ?? [];

  const byDay = WEEKDAY_ORDER.map((day) => ({
    day,
    rows: entries.filter((e) => e.weekday === day),
  })).filter((d) => d.rows.length > 0);

  return (
    <ScreenScaffold title="Timetable">
      {query.isLoading ? (
        <ActivityIndicator />
      ) : entries.length === 0 ? (
        <Text className="text-muted-foreground">No timetable has been published yet.</Text>
      ) : (
        byDay.map(({ day, rows }) => (
          <View key={day} className="gap-2">
            <Text className="text-sm font-medium text-muted-foreground">{WEEKDAY_LABEL[day]}</Text>
            {rows.map((e) => (
              <EntryRow key={e.id} entry={e} isParent={isParent} />
            ))}
          </View>
        ))
      )}
    </ScreenScaffold>
  );
}

function EntryRow({ entry, isParent }: { entry: TimetableEntryDto; isParent: boolean }) {
  // Parents see WHO teaches + which section; teachers see which section they teach.
  const secondary = [isParent ? entry.teacherName : null, entry.sectionName, entry.room]
    .filter(Boolean)
    .join(" · ");
  return (
    <View className="flex-row gap-3 rounded-md border border-border bg-card p-4">
      <View className="w-20">
        <Text className="font-medium text-foreground">{entry.startTime}</Text>
        <Text className="text-xs text-muted-foreground">{entry.endTime}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-medium text-foreground">{entry.subjectName}</Text>
        {secondary ? <Text className="text-sm text-muted-foreground">{secondary}</Text> : null}
      </View>
    </View>
  );
}
