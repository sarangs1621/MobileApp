import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { ScreenScaffold, todayIst } from "../../../components/attendance-ui";
import { Chip, Field } from "../../../components/behaviour-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

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
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={tr.newHomework}>
      {rows.length === 0 ? (
        <Text className="font-sans text-neutral-500">{tr.noAssignments}</Text>
      ) : (
        <>
          <Field label={tr.subjectAndSection}>
            <View className="flex-row flex-wrap gap-2">
              {rows.map((t) => {
                const key = `${t.subjectId}:${t.sectionId}`;
                return (
                  <Chip
                    key={key}
                    label={`${t.subjectName} · ${t.sectionName}`}
                    active={key === pair}
                    onPress={() => setPair(key)}
                  />
                );
              })}
            </View>
          </Field>

          <Field label={tr.titlePlaceholder}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={tr.titlePlaceholder}
              placeholderTextColor="#948676"
              className={inputClass}
            />
          </Field>
          <Field label={tr.descriptionPlaceholder}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={tr.descriptionPlaceholder}
              placeholderTextColor="#948676"
              multiline
              textAlignVertical="top"
              className={`${inputClass} min-h-24`}
            />
          </Field>
          <Field label={tr.dueDateLabel}>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#948676"
              autoCapitalize="none"
              className={inputClass}
            />
          </Field>

          <Button
            label={tr.createDraft}
            loading={create.isPending}
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
          />
          {create.isError ? (
            <Text className="font-sans text-sm text-danger-600">{create.error.message}</Text>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}
