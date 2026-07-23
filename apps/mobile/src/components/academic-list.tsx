import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import type { ReactElement, ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Read-only list scaffold shared by the M2 academic placeholder screens
 * (years/classes/subjects/assignments). Header + back, loading/error/empty
 * states, and a FlatList of caller-rendered rows. No editing UI — admin CRUD
 * is web-primary (UI_DESIGN_SYSTEM.md §13); editing screens are out of M2 scope.
 */
export function AcademicListScreen<T>({
  title,
  isLoading,
  isError,
  items,
  keyExtractor,
  renderItem,
  emptyText,
}: {
  title: string;
  isLoading: boolean;
  isError: boolean;
  items: readonly T[] | undefined;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  emptyText: string;
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

      {isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center font-sans text-danger-600">
            Couldn’t load this list. You may not have access, or the server is unreachable.
          </Text>
        </View>
      ) : isLoading || items === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7A3414" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center font-sans text-neutral-500">{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          data={items as T[]}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => renderItem(item)}
          contentContainerClassName="p-4 gap-3"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

/** A card-style row (design handoff). */
export function ListRow({ children }: { children: ReactNode }) {
  return (
    <View className="gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm">
      {children}
    </View>
  );
}
