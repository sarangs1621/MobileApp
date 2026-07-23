import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text } from "react-native";

import type { PhosphorIcon } from "./icon";

/**
 * Button (design handoff, mobile). Pill radius, maroon primary, semibold label,
 * >=44pt tap target; loading shows a spinner and disables. Prefer the Phosphor
 * `Icon` component (matches web); the legacy Feather `icon` string stays for
 * not-yet-migrated screens.
 */
type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, { box: string; text: string; on: string }> = {
  primary: { box: "bg-primary-600 active:bg-primary-700", text: "text-neutral-50", on: "#FCF9F3" },
  secondary: {
    box: "border border-strong bg-white active:bg-primary-50",
    text: "text-primary-700",
    on: "#642811",
  },
  ghost: { box: "active:bg-primary-50", text: "text-primary-700", on: "#642811" },
  destructive: {
    box: "bg-danger-600 active:bg-danger-700",
    text: "text-neutral-50",
    on: "#FCF9F3",
  },
};

const SIZE: Record<Size, { box: string; text: string }> = {
  sm: { box: "min-h-10 px-4", text: "text-sm" },
  md: { box: "min-h-12 px-5", text: "text-body" },
  lg: { box: "min-h-14 px-6", text: "text-body" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  Icon,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  /** Preferred: a Phosphor icon component (matches web). */
  Icon?: PhosphorIcon;
  /** Legacy Feather glyph — kept for screens not yet on Phosphor. */
  icon?: keyof typeof Feather.glyphMap;
}) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const isOff = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff }}
      disabled={isOff}
      onPress={onPress}
      className={`${s.box} flex-row items-center justify-center gap-2 rounded-pill ${v.box} ${
        isOff ? "opacity-50" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.on} />
      ) : Icon ? (
        <Icon size={18} color={v.on} weight="bold" />
      ) : icon ? (
        <Feather name={icon} size={16} color={v.on} />
      ) : null}
      <Text className={`font-sans font-semibold ${s.text} ${v.text}`}>{label}</Text>
    </Pressable>
  );
}
