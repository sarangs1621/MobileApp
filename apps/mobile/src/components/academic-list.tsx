import { useRouter } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

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

      {isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-destructive">
            Couldn’t load this list. You may not have access, or the server is unreachable.
          </Text>
        </View>
      ) : isLoading || items === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          data={items as T[]}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => renderItem(item)}
          contentContainerClassName="p-4 gap-3"
        />
      )}
    </View>
  );
}

/** A bordered, card-style row (UI_DESIGN_SYSTEM.md §10). */
export function ListRow({ children }: { children: ReactNode }) {
  return <View className="gap-1 rounded-md border border-border bg-card p-4">{children}</View>;
}
