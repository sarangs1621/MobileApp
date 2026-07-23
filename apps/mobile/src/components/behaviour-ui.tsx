import type { BehaviourCategoryKey, BehaviourSeverityKey, BehaviourStatusKey } from "@repo/types";
import { CaretLeft } from "phosphor-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Shared labels + presentational bits for the M12 discipline screens (ADR-020),
 *  on the design-handoff heritage look. Header/Field/Chip are reused across the
 *  behaviour, documents and fees screens. */

export const CATEGORY_LABEL: Record<BehaviourCategoryKey, string> = {
  DISCIPLINE: "Discipline",
  BULLYING: "Bullying",
  UNIFORM: "Uniform",
  HOMEWORK: "Homework",
  MISCONDUCT: "Misconduct",
  LATE: "Late",
  OTHER: "Other",
};

export const SEVERITY_LABEL: Record<BehaviourSeverityKey, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUS_LABEL: Record<BehaviourStatusKey, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const SEVERITY_CLASS: Record<BehaviourSeverityKey, string> = {
  LOW: "text-neutral-500",
  MEDIUM: "text-info-600",
  HIGH: "text-primary-700",
  CRITICAL: "text-danger-600",
};

const STATUS_CLASS: Record<BehaviourStatusKey, string> = {
  OPEN: "text-info-600",
  IN_PROGRESS: "text-primary-700",
  RESOLVED: "text-success-600",
  CLOSED: "text-neutral-500",
};

export function SeverityText({ severity }: { severity: BehaviourSeverityKey }) {
  return (
    <Text className={`font-sans text-caption font-semibold ${SEVERITY_CLASS[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </Text>
  );
}

export function StatusText({ status }: { status: BehaviourStatusKey }) {
  return (
    <Text className={`font-sans text-caption font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </Text>
  );
}

export function Loading() {
  return (
    <View className="items-center py-8">
      <ActivityIndicator color="#7A3414" />
    </View>
  );
}

/** Screen top bar — white surface, sand hairline, Phosphor back caret, serif title. */
export function Header({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingTop: insets.top + 12 }}
      className="flex-row items-center gap-2 border-b border-subtle bg-white px-3 pb-3"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        className="size-11 items-center justify-center rounded-xl active:bg-primary-50"
      >
        <CaretLeft size={22} color="#44382C" weight="bold" />
      </Pressable>
      <View className="flex-1">
        <Text className="font-display text-title text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-sans text-caption text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="font-sans text-sm font-semibold text-neutral-900">{label}</Text>
      {children}
    </View>
  );
}

/** Selectable pill (filters, category/severity choices). */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`min-h-10 justify-center rounded-pill border px-4 ${
        active ? "border-primary-600 bg-primary-50" : "border-subtle bg-white"
      }`}
    >
      <Text
        className={`font-sans text-sm font-semibold ${
          active ? "text-primary-800" : "text-neutral-500"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
