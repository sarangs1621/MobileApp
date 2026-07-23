import type { BehaviourCategoryKey, BehaviourSeverityKey } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import {
  CATEGORY_LABEL,
  Chip,
  Field,
  Header,
  SEVERITY_LABEL,
} from "../../../components/behaviour-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as BehaviourCategoryKey[];
const SEVERITIES = Object.keys(SEVERITY_LABEL) as BehaviourSeverityKey[];
const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

/**
 * Record a behaviour incident for a student (M12 Step 6). Teacher path — `teacherId`
 * is server-set to self and the ACTIVE-year enrollment derived; the client sends only
 * studentId + the incident fields. On success, the student's history is invalidated.
 */
export default function NewBehaviourScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const utils = trpc.useUtils();

  const [category, setCategory] = useState<BehaviourCategoryKey>("DISCIPLINE");
  const [severity, setSeverity] = useState<BehaviourSeverityKey>("LOW");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  const create = trpc.behaviour.create.useMutation({
    onSuccess: () => {
      if (studentId) void utils.behaviour.listByStudent.invalidate({ studentId });
      router.back();
    },
  });

  const valid = !!studentId && title.trim().length > 0 && description.trim().length > 0;
  const saving = create.isPending;

  const save = () => {
    if (!studentId) return;
    create.mutate({
      studentId,
      category,
      severity,
      title: title.trim(),
      description: description.trim(),
      ...(actionTaken.trim() ? { actionTaken: actionTaken.trim() } : {}),
    });
  };

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title="New incident" onBack={() => router.back()} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Field label="Category">
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={CATEGORY_LABEL[c]}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </Field>

        <Field label="Severity">
          <View className="flex-row flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <Chip
                key={s}
                label={SEVERITY_LABEL[s]}
                active={severity === s}
                onPress={() => setSeverity(s)}
              />
            ))}
          </View>
        </Field>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Short summary"
            placeholderTextColor="#948676"
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What happened…"
            placeholderTextColor="#948676"
            multiline
            className={`${inputClass} min-h-32`}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Action taken (optional)">
          <TextInput
            value={actionTaken}
            onChangeText={setActionTaken}
            placeholder="Any action already taken"
            placeholderTextColor="#948676"
            multiline
            className={`${inputClass} min-h-20`}
            textAlignVertical="top"
          />
        </Field>

        <Button
          label={saving ? "Saving…" : "Record incident"}
          loading={saving}
          disabled={!valid}
          onPress={save}
        />
        <Text className="px-1 font-sans text-caption text-neutral-400">
          The student’s parents are notified when the incident is recorded.
        </Text>
      </ScrollView>
    </View>
  );
}
