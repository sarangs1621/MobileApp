import type { AttendanceStatusKey, LeaveStatusKey } from "@repo/types";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

/** The five marks, in register display order (ADR-011). */
export const ATTENDANCE_STATUSES: readonly AttendanceStatusKey[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
];

export const STATUS_LABEL: Record<AttendanceStatusKey, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
};

export const STATUS_CLASS: Record<AttendanceStatusKey, string> = {
  PRESENT: "text-success",
  ABSENT: "text-destructive",
  LATE: "text-info",
  HALF_DAY: "text-muted-foreground",
  LEAVE: "text-muted-foreground",
};

export const LEAVE_STATUS_CLASS: Record<LeaveStatusKey, string> = {
  PENDING: "text-info",
  APPROVED: "text-success",
  REJECTED: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

/** Today as an IST calendar date (YYYY-MM-DD) using the device locale (en-CA = ISO). */
export function todayIst(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** First day of the current month (YYYY-MM-01). */
export function monthStartIst(): string {
  return `${todayIst().slice(0, 8)}01`;
}

/** Header with a back button + title, shared by the custom (non-list) screens. */
export function ScreenScaffold({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            router.back();
          }}
          className="min-h-11 min-w-11 items-center justify-center rounded-md"
        >
          <Text className="text-lg text-foreground">←</Text>
        </Pressable>
        <Text className="text-xl font-semibold text-foreground">{title}</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 gap-3">{children}</ScrollView>
    </View>
  );
}

/** A row of status buttons; the selected one is highlighted. */
export function StatusPicker({
  value,
  onChange,
}: {
  value: AttendanceStatusKey;
  onChange: (status: AttendanceStatusKey) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {ATTENDANCE_STATUSES.map((status) => {
        const selected = status === value;
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(status);
            }}
            className={`min-h-11 justify-center rounded-md border px-3 py-2 ${
              selected ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <Text className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
              {STATUS_LABEL[status]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
