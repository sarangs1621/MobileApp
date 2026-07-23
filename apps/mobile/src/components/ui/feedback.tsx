import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "./button";
import type { PhosphorIcon } from "./icon";

/**
 * Status + feedback primitives (design handoff, mobile). StatusChip renders every
 * enum through one tone map — soft tint fill + strong text, never colour alone.
 * `statusTone`/`titleCase` mirror the web kit.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "gold";

const CHIP: Record<Tone, string> = {
  success: "bg-success-100",
  warning: "bg-warning-100",
  danger: "bg-danger-100",
  info: "bg-info-100",
  neutral: "bg-neutral-200",
  brand: "bg-primary-100",
  gold: "bg-gold-100",
};
const CHIP_TEXT: Record<Tone, string> = {
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-danger-700",
  info: "text-info-700",
  neutral: "text-neutral-700",
  brand: "text-primary-800",
  gold: "text-gold-800",
};
const DOT: Record<Tone, string> = {
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
  neutral: "bg-neutral-500",
  brand: "bg-primary-700",
  gold: "bg-gold-700",
};

const STATUS_TONE: Record<string, Tone> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  LEAVE: "info",
  HALF_DAY: "warning",
  PUBLISHED: "success",
  APPROVED: "success",
  LOCKED: "success",
  DRAFT: "info",
  SUBMITTED: "info",
  GENERATED: "info",
  UPLOADED: "info",
  OPEN: "info",
  PENDING: "warning",
  IN_PROGRESS: "warning",
  RETURNED: "warning",
  PARTIAL: "warning",
  CLOSED: "neutral",
  ARCHIVED: "neutral",
  SUPERSEDED: "neutral",
  CANCELLED: "neutral",
  REVOKED: "danger",
  PAID: "success",
  ISSUED: "info",
  OVERDUE: "danger",
  RESOLVED: "success",
  REJECTED: "danger",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status.toUpperCase()] ?? "neutral";
}
export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusChip({
  status,
  tone,
  label,
  dot,
}: {
  status?: string;
  tone?: Tone;
  label?: string;
  /** Leading tone dot (handoff "Action needed" style). */
  dot?: boolean;
}) {
  const t = tone ?? (status ? statusTone(status) : "neutral");
  const text = label ?? (status ? titleCase(status) : "");
  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${CHIP[t]}`}
    >
      {dot ? <View className={`size-1.5 rounded-full ${DOT[t]}`} /> : null}
      <Text className={`text-caption font-semibold ${CHIP_TEXT[t]}`}>{text}</Text>
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View className={`self-start rounded-full px-1.5 py-0.5 ${CHIP[tone]}`}>
      <Text className={`text-caption font-semibold ${CHIP_TEXT[tone]}`}>{label}</Text>
    </View>
  );
}

const TONE_ICON_COLOR: Record<Tone, string> = {
  success: "#32633F",
  warning: "#8F6318",
  danger: "#922F20",
  info: "#254B70",
  neutral: "#5A4C3F",
  brand: "#642811",
  gold: "#6F4E13",
};

export function Banner({
  tone = "warning",
  icon = "alert-triangle",
  Icon,
  children,
}: {
  tone?: Tone;
  icon?: keyof typeof Feather.glyphMap;
  Icon?: PhosphorIcon;
  children: ReactNode;
}) {
  const color = TONE_ICON_COLOR[tone];
  return (
    <View className={`flex-row items-start gap-2 rounded-xl p-3 ${CHIP[tone]}`}>
      {Icon ? (
        <Icon size={16} color={color} weight="bold" />
      ) : (
        <Feather name={icon} size={16} color={color} />
      )}
      <View className="flex-1">
        <Text className={`text-sm ${CHIP_TEXT[tone]}`}>{children}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  Icon,
  title,
  message,
  action,
}: {
  icon?: keyof typeof Feather.glyphMap;
  Icon?: PhosphorIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-12">
      <View className="size-12 items-center justify-center rounded-2xl bg-neutral-100">
        {Icon ? (
          <Icon size={24} color="#948676" weight="regular" />
        ) : (
          <Feather name={icon} size={24} color="#948676" />
        )}
      </View>
      <Text className="font-display text-title text-neutral-800">{title}</Text>
      {message ? (
        <Text className="font-sans text-center text-sm text-neutral-500">{message}</Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-12">
      <View className="size-12 items-center justify-center rounded-full bg-danger-50">
        <Feather name="alert-triangle" size={24} color="#B23A28" />
      </View>
      <Text className="font-sans text-center text-sm text-neutral-600">
        {message ?? "Something went wrong. You may not have access, or the server is unreachable."}
      </Text>
      {onRetry ? (
        <Button label="Retry" variant="secondary" icon="refresh-cw" onPress={onRetry} />
      ) : null}
    </View>
  );
}

/** Skeleton — a neutral block mirroring the final layout (shimmer deferred). */
export function Skeleton({ className }: { className?: string }) {
  return <View className={`rounded-md bg-neutral-200 ${className ?? ""}`} />;
}
