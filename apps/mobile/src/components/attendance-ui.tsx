import { useTranslation } from "@repo/i18n";
import type { AttendanceStatusKey, LeaveStatusKey } from "@repo/types";
import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  PRESENT: "text-success-600",
  ABSENT: "text-danger-600",
  LATE: "text-info-600",
  HALF_DAY: "text-neutral-500",
  LEAVE: "text-neutral-500",
};

export const LEAVE_STATUS_CLASS: Record<LeaveStatusKey, string> = {
  PENDING: "text-info-600",
  APPROVED: "text-success-600",
  REJECTED: "text-danger-600",
  CANCELLED: "text-neutral-500",
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
  const { dict } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-neutral-50">
      <View
        style={{ paddingTop: insets.top + 12 }}
        className="flex-row items-center gap-2 border-b border-subtle bg-white px-3 pb-3"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dict.attendance.goBack}
          onPress={() => {
            router.back();
          }}
          className="size-11 items-center justify-center rounded-xl active:bg-primary-50"
        >
          <CaretLeft size={22} color="#44382C" weight="bold" />
        </Pressable>
        <Text className="flex-1 font-display text-title text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ScrollView
        contentContainerClassName="p-4 gap-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {children}
      </ScrollView>
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
            className={`min-h-11 justify-center rounded-pill border px-4 py-2 ${
              selected ? "border-primary-600 bg-primary-50" : "border-subtle bg-white"
            }`}
          >
            <Text
              className={`font-sans text-sm font-semibold ${
                selected ? "text-primary-800" : "text-neutral-500"
              }`}
            >
              {STATUS_LABEL[status]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
