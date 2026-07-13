import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ScreenScaffold, todayIst } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

/**
 * Teacher: create a DRAFT homework (M6). Pick one of your (subject × section)
 * targets, set a title, optional description, and a due date (YYYY-MM-DD). The
 * service stamps the active year and derives ownership; the draft is then published
 * from the detail screen. Files are added on web (mobile has no picker).
 */
export default function NewHomeworkScreen() {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const router = useRouter();
  const utils = trpc.useUtils();
  const targets = trpc.homework.targets.useQuery();
  const rows = targets.data ?? [];

  const [pair, setPair] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayIst());

  const create = trpc.homework.create.useMutation({
    onSuccess: () => {
      void utils.homework.list.invalidate();
      router.back();
    },
  });

  const selected = rows.find((t) => `${t.subjectId}:${t.sectionId}` === pair);
  const canSubmit = selected !== undefined && title.trim() !== "" && !create.isPending;

  if (targets.isLoading) {
    return (
      <ScreenScaffold title={tr.newHomework}>
        <ActivityIndicator />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={tr.newHomework}>
      {rows.length === 0 ? (
        <Text className="text-muted-foreground">{tr.noAssignments}</Text>
      ) : (
        <>
          <Text className="text-sm font-medium text-muted-foreground">{tr.subjectAndSection}</Text>
          <View className="flex-row flex-wrap gap-2">
            {rows.map((t) => {
              const key = `${t.subjectId}:${t.sectionId}`;
              const on = key === pair;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPair(key)}
                  className={`min-h-11 justify-center rounded-md border px-3 py-2 ${
                    on ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${on ? "text-primary" : "text-foreground"}`}
                  >
                    {t.subjectName} · {t.sectionName}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={tr.titlePlaceholder}
            className="min-h-11 rounded-md border border-border px-3 text-foreground"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={tr.descriptionPlaceholder}
            multiline
            className="min-h-24 rounded-md border border-border px-3 py-2 text-foreground"
          />
          <Text className="text-sm font-medium text-muted-foreground">{tr.dueDateLabel}</Text>
          <TextInput
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            className="min-h-11 rounded-md border border-border px-3 text-foreground"
          />

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() => {
              if (!selected) return;
              create.mutate({
                subjectId: selected.subjectId,
                sectionId: selected.sectionId,
                title: title.trim(),
                description: description.trim() === "" ? null : description.trim(),
                dueDate,
              });
            }}
            className={`min-h-11 items-center justify-center rounded-md px-4 py-3 ${
              canSubmit ? "bg-primary" : "bg-primary/40"
            }`}
          >
            <Text className="font-medium text-primary-foreground">{tr.createDraft}</Text>
          </Pressable>
          {create.isError ? (
            <Text className="text-sm text-destructive">{create.error.message}</Text>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}
