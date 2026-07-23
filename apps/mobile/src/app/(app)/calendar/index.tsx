import { useTranslation } from "@repo/i18n";
import type { CalendarEventDto, CalendarEventTypeKey } from "@repo/types";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { EVENT_TYPE_LABEL, formatDate, Loading } from "../../../components/announcements-ui";
import { ScreenScaffold } from "../../../components/attendance-ui";
import { Chip } from "../../../components/behaviour-ui";
import { StatusChip, type Tone } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const TYPE_FILTERS: (CalendarEventTypeKey | "ALL")[] = [
  "ALL",
  "HOLIDAY",
  "EXAM",
  "EVENT",
  "MEETING",
];
const TYPE_TONE: Record<CalendarEventTypeKey, Tone> = {
  HOLIDAY: "success",
  EVENT: "neutral",
  EXAM: "brand",
  MEETING: "gold",
  OTHER: "neutral",
};

/**
 * School calendar (M11 Step 6). Upcoming (soonest first) or a month view; a type
 * filter covers "upcoming holidays" and the "exam schedule". Read-only for teachers
 * and parents (calendar:read). Events are enriched date strings — no id lookups.
 */
export default function CalendarScreen() {
  const { dict } = useTranslation();
  const t = dict.announcements;
  const now = new Date();
  const [mode, setMode] = useState<"UPCOMING" | "MONTH">("UPCOMING");
  const [type, setType] = useState<CalendarEventTypeKey | "ALL">("ALL");
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1); // 1-based

  const typeArg = type === "ALL" ? {} : { eventType: type };
  const upcoming = trpc.calendar.upcoming.useQuery(
    { limit: 50, ...typeArg },
    { enabled: mode === "UPCOMING" },
  );
  const monthly = trpc.calendar.month.useQuery(
    { year, month, ...typeArg },
    { enabled: mode === "MONTH" },
  );
  const query = mode === "UPCOMING" ? upcoming : monthly;
  const events = query.data ?? [];

  const stepMonth = (delta: number) => {
    const m0 = month - 1 + delta;
    setYear((y) => y + Math.floor(m0 / 12));
    setMonth((((m0 % 12) + 12) % 12) + 1);
  };

  return (
    <ScreenScaffold title={t.calendarTitle}>
      <View className="flex-row gap-2">
        {(["UPCOMING", "MONTH"] as const).map((m) => (
          <Chip
            key={m}
            label={m === "UPCOMING" ? t.upcoming : t.month}
            active={mode === m}
            onPress={() => setMode(m)}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {TYPE_FILTERS.map((filter) => (
          <Chip
            key={filter}
            label={filter === "ALL" ? t.all : EVENT_TYPE_LABEL[filter]}
            active={type === filter}
            onPress={() => setType(filter)}
          />
        ))}
      </View>

      {mode === "MONTH" ? (
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.previousMonth}
            onPress={() => stepMonth(-1)}
            className="size-11 items-center justify-center rounded-xl border border-subtle bg-white active:bg-primary-50"
          >
            <CaretLeft size={18} color="#7A3414" weight="bold" />
          </Pressable>
          <Text className="font-display text-title text-neutral-900">
            {MONTHS[month - 1]} {year}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.nextMonth}
            onPress={() => stepMonth(1)}
            className="size-11 items-center justify-center rounded-xl border border-subtle bg-white active:bg-primary-50"
          >
            <CaretRight size={18} color="#7A3414" weight="bold" />
          </Pressable>
        </View>
      ) : null}

      {query.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          scrollEnabled={false}
          contentContainerClassName="gap-3"
          ListEmptyComponent={
            <Text className="font-sans text-neutral-500">
              {mode === "UPCOMING" ? t.noUpcomingEvents : t.noEventsThisMonth}
            </Text>
          }
          renderItem={({ item }) => <EventRow event={item} />}
        />
      )}
    </ScreenScaffold>
  );
}

function EventRow({ event }: { event: CalendarEventDto }) {
  const range =
    event.startDate === event.endDate
      ? formatDate(event.startDate)
      : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
  return (
    <View className="gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
          {event.title}
        </Text>
        <StatusChip
          tone={TYPE_TONE[event.eventType]}
          label={EVENT_TYPE_LABEL[event.eventType]}
          dot
        />
      </View>
      <Text className="font-sans text-sm text-neutral-500">{range}</Text>
      {event.description ? (
        <Text className="font-sans text-sm text-neutral-500">{event.description}</Text>
      ) : null}
    </View>
  );
}
