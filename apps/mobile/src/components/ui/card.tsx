import type { ReactNode } from "react";
import { Text, View } from "react-native";

import type { PhosphorIcon } from "./icon";

/**
 * Card (design handoff, mobile) — white surface on the parchment page, sand
 * hairline, 16px radius, soft warm shadow. Optional domain `accent` renders a
 * left border so modules scan fast (legacy screens; the handoff mostly drops it).
 */
type Accent = "attendance" | "exams" | "homework" | "fees" | "calendar" | "messages";

const ACCENT: Record<Accent, string> = {
  attendance: "border-l-4 border-l-attendance",
  exams: "border-l-4 border-l-exams",
  homework: "border-l-4 border-l-homework",
  fees: "border-l-4 border-l-fees",
  calendar: "border-l-4 border-l-calendar",
  messages: "border-l-4 border-l-messages",
};

export function Card({
  children,
  accent,
  className,
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <View
      className={`rounded-card border border-subtle bg-card p-4 shadow-sm ${
        accent ? ACCENT[accent] : ""
      } ${className ?? ""}`}
    >
      {children}
    </View>
  );
}

/** Tinted icon tile — the header glyph on section cards / list rows. */
export function IconTile({
  Icon,
  tint = "maroon",
  size = 38,
}: {
  Icon: PhosphorIcon;
  tint?: "maroon" | "gold" | "cream";
  size?: number;
}) {
  const tone = {
    maroon: { box: "bg-primary-50", color: "#7A3414" },
    gold: { box: "bg-gold-100", color: "#8A661F" },
    cream: { box: "bg-neutral-100", color: "#44382C" },
  }[tint];
  return (
    <View
      className={`items-center justify-center rounded-xl ${tone.box}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} color={tone.color} weight="bold" />
    </View>
  );
}

/**
 * SectionCard — a card with a tinted icon header (serif title + subtitle) over a
 * hairline, then a padded body. Mirrors the web handoff's settings/detail cards.
 */
export function SectionCard({
  Icon,
  tint = "maroon",
  title,
  subtitle,
  children,
}: {
  Icon: PhosphorIcon;
  tint?: "maroon" | "gold" | "cream";
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="overflow-hidden rounded-card border border-subtle bg-card shadow-sm">
      <View className="flex-row items-center gap-3 border-b border-neutral-100 px-4 py-4">
        <IconTile Icon={Icon} tint={tint} />
        <View className="flex-1">
          <Text className="font-display text-title text-neutral-900">{title}</Text>
          {subtitle ? <Text className="font-sans text-sm text-neutral-500">{subtitle}</Text> : null}
        </View>
      </View>
      <View className="gap-4 p-4">{children}</View>
    </View>
  );
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: Accent;
}) {
  return (
    <Card accent={accent} className="gap-1">
      <Text className="font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
        {label}
      </Text>
      <Text className="font-display text-display text-neutral-900">{value}</Text>
    </Card>
  );
}
