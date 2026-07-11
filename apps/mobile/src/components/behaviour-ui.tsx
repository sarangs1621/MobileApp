import type { BehaviourCategoryKey, BehaviourSeverityKey, BehaviourStatusKey } from "@repo/types";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

/** Shared labels + presentational bits for the M12 discipline screens (ADR-020). */

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
  LOW: "text-muted-foreground",
  MEDIUM: "text-info",
  HIGH: "text-primary",
  CRITICAL: "text-destructive",
};

const STATUS_CLASS: Record<BehaviourStatusKey, string> = {
  OPEN: "text-info",
  IN_PROGRESS: "text-primary",
  RESOLVED: "text-success",
  CLOSED: "text-muted-foreground",
};

export function SeverityText({ severity }: { severity: BehaviourSeverityKey }) {
  return (
    <Text className={`text-xs font-semibold ${SEVERITY_CLASS[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </Text>
  );
}

export function StatusText({ status }: { status: BehaviourStatusKey }) {
  return (
    <Text className={`text-xs font-medium ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</Text>
  );
}

export function Loading() {
  return (
    <View className="items-center py-8">
      <ActivityIndicator />
    </View>
  );
}

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        className="min-h-11 min-w-11 items-center justify-center rounded-md"
      >
        <Text className="text-lg text-foreground">←</Text>
      </Pressable>
      <Text className="flex-1 text-xl font-semibold text-foreground">{title}</Text>
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

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
      onPress={onPress}
      className={`min-h-11 justify-center rounded-md px-3 ${
        active ? "bg-primary" : "border border-border bg-background"
      }`}
    >
      <Text className={active ? "text-primary-foreground" : "text-foreground"}>{label}</Text>
    </Pressable>
  );
}
