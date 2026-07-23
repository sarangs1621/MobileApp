import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * ScreenScaffold (design handoff, mobile) — parchment app background, white
 * header with a sand hairline, Phosphor back caret, serif title (+ optional
 * subtitle) and a right action slot, plus built-in pull-to-refresh.
 */
export function ScreenScaffold({
  title,
  subtitle,
  action,
  onRefresh,
  refreshing,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
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
          accessibilityLabel="Go back"
          onPress={() => router.back()}
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
      <ScrollView
        contentContainerClassName="p-4 gap-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Gold eyebrow + serif heading — the handoff section intro, for in-scroll use. */
export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View className="gap-1">
      {eyebrow ? (
        <View className="flex-row items-center gap-2">
          <View className="h-0.5 w-7 bg-gold-500" />
          <Text className="font-sans text-eyebrow font-semibold uppercase tracking-eyebrow text-gold-700">
            {eyebrow}
          </Text>
        </View>
      ) : null}
      <Text className="font-display text-title text-neutral-900">{title}</Text>
    </View>
  );
}

/** SegmentedControl — pill tabs in a cream track (Staff / Parent, filters, etc.). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row self-start rounded-pill bg-neutral-100 p-1">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.key)}
            className={`min-h-9 flex-1 items-center justify-center rounded-pill px-4 ${
              active ? "bg-primary-600" : ""
            }`}
          >
            <Text
              className={`font-sans text-sm font-semibold ${
                active ? "text-neutral-50" : "text-neutral-500"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
