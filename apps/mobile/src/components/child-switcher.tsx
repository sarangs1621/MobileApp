import { Pressable, ScrollView, Text } from "react-native";

/**
 * Horizontal child selector for parents with more than one child (design assumes
 * a single child; this keeps multi-child parents first-class). Renders nothing
 * for a single child so single-child parents see no chrome.
 */
export function ChildSwitcher({
  students,
  selected,
  onSelect,
}: {
  students: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (students.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pr-4"
    >
      {students.map((s) => {
        const active = s.id === selected;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(s.id)}
            className={`min-h-9 justify-center rounded-pill px-4 ${
              active ? "bg-primary-700" : "border border-subtle bg-white"
            }`}
          >
            <Text
              className={`font-sans text-sm font-semibold ${
                active ? "text-neutral-50" : "text-neutral-600"
              }`}
            >
              {s.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
