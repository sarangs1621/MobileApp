import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { ScreenScaffold, todayIst } from "../../../components/attendance-ui";
import { Chip, Field } from "../../../components/behaviour-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

/**
 * Teacher: create a homework (M6). Pick one of your (subject × section) targets,
 * set a title, optional description, and a due date (YYYY-MM-DD). The service stamps
 * the active year and derives ownership. "Publish" creates then publishes in one step
 * (reaching parents immediately, same as web); "Create draft" leaves it unpublished to
 * finish later. Files are added on web (mobile has no picker).
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

  // M-3: pre-select the first (subject × section) chip so the primary button is
  // enabled by default (matches web, which defaults to targets[0]).
  useEffect(() => {
    if (pair === null && rows[0]) {
      setPair(`${rows[0].subjectId}:${rows[0].sectionId}`);
    }
  }, [rows, pair]);

  const create = trpc.homework.create.useMutation();
  const publish = trpc.homework.publish.useMutation();

  const done = () => {
    void utils.homework.list.invalidate();
    router.back();
  };
  const busy = create.isPending || publish.isPending;

  const selected = rows.find((t) => `${t.subjectId}:${t.sectionId}` === pair);
  const canSubmit = selected !== undefined && title.trim() !== "" && !busy;

  // Same create → optional publish flow the web create modal uses: publish is a
  // separate mutation run after create succeeds (ADR-018 §3), not a create flag.
  const submit = (publishNow: boolean) => {
    if (!selected || title.trim() === "" || busy) return;
    create.mutate(
      {
        subjectId: selected.subjectId,
        sectionId: selected.sectionId,
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        dueDate,
      },
      {
        onSuccess: (created) => {
          if (publishNow && created?.id) {
            publish.mutate({ homeworkId: created.id }, { onSuccess: done });
          } else {
            done();
          }
        },
      },
    );
  };

  const err = create.error ?? publish.error;

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
            label={tr.publish}
            loading={publish.isPending}
            disabled={!canSubmit}
            onPress={() => submit(true)}
          />
          <Button
            label={tr.createDraft}
            variant="secondary"
            loading={busy && !publish.isPending}
            disabled={!canSubmit}
            onPress={() => submit(false)}
          />
          {err ? <Text className="font-sans text-sm text-danger-600">{err.message}</Text> : null}
        </>
      )}
    </ScreenScaffold>
  );
}
