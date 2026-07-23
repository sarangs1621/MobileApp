import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import type { AnnouncementScopeKey } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Loading, SCOPE_LABEL } from "../../../components/announcements-ui";
import { Chip, Field, Header } from "../../../components/behaviour-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const ADMIN_SCOPES: AnnouncementScopeKey[] = ["WHOLE_SCHOOL", "TEACHERS", "PARENTS"];
const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

/**
 * Create / edit an announcement DRAFT (M11 Step 6). Admins pick a school-wide scope
 * (WHOLE_SCHOOL / TEACHERS / PARENTS); teachers author a SECTION draft for one of
 * their sections (SECTION/CLASS targeting is a web-console job otherwise). Edit mode
 * (`?id=`) prefills + updates title/body. Publishing is done from the detail screen.
 */
export default function AnnouncementFormScreen() {
  const { dict } = useTranslation();
  const t = dict.announcements;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const router = useRouter();
  const utils = trpc.useUtils();
  const role = trpc.auth.me.useQuery().data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_MANAGE);

  const existing = trpc.announcement.get.useQuery({ id: id ?? "" }, { enabled: isEdit });
  // Teacher's own sections (reuse the homework assignable targets — same TeacherAssignment source).
  const targets = trpc.homework.targets.useQuery(undefined, { enabled: !canManage });
  const sections = [
    ...new Map((targets.data ?? []).map((t) => [t.sectionId, t.sectionName])).entries(),
  ].map(([sectionId, sectionName]) => ({ sectionId, sectionName }));

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<AnnouncementScopeKey>(canManage ? "WHOLE_SCHOOL" : "SECTION");
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (existing.data) {
      setTitle(existing.data.title);
      setBody(existing.data.body);
      setScope(existing.data.scope);
      setTargetId(existing.data.targetId);
    }
  }, [existing.data]);

  const onDone = () => {
    void utils.announcement.list.invalidate();
    if (isEdit) void utils.announcement.get.invalidate({ id });
    router.back();
  };
  const create = trpc.announcement.create.useMutation({ onSuccess: onDone });
  const update = trpc.announcement.update.useMutation({ onSuccess: onDone });

  const needsSection = !canManage;
  const valid = title.trim().length > 0 && body.trim().length > 0 && (!needsSection || !!targetId);
  const saving = create.isPending || update.isPending;

  const save = () => {
    if (isEdit) {
      update.mutate({ id, title: title.trim(), body: body.trim() });
    } else {
      create.mutate({
        title: title.trim(),
        body: body.trim(),
        scope,
        ...(targetId ? { targetId } : {}),
      });
    }
  };

  if (isEdit && existing.isLoading) {
    return (
      <View className="flex-1 bg-neutral-50">
        <Header title={t.editDraft} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title={isEdit ? t.editDraft : t.newAnnouncement} onBack={() => router.back()} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Field label={t.titleLabel}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t.titlePlaceholder}
            placeholderTextColor="#948676"
            className={inputClass}
          />
        </Field>

        <Field label={t.message}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t.messagePlaceholder}
            placeholderTextColor="#948676"
            multiline
            className={`${inputClass} min-h-32`}
            textAlignVertical="top"
          />
        </Field>

        {/* Scope is fixed once created — only editable while creating. */}
        {!isEdit ? (
          canManage ? (
            <Field label={t.audience}>
              <View className="flex-row flex-wrap gap-2">
                {ADMIN_SCOPES.map((s) => (
                  <Chip
                    key={s}
                    label={SCOPE_LABEL[s]}
                    active={scope === s}
                    onPress={() => setScope(s)}
                  />
                ))}
              </View>
            </Field>
          ) : (
            <Field label={t.section}>
              {targets.isLoading ? (
                <Loading />
              ) : sections.length === 0 ? (
                <Text className="font-sans text-sm text-neutral-500">{t.noAssignedSections}</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {sections.map((s) => (
                    <Chip
                      key={s.sectionId}
                      label={s.sectionName}
                      active={targetId === s.sectionId}
                      onPress={() => {
                        setScope("SECTION");
                        setTargetId(s.sectionId);
                      }}
                    />
                  ))}
                </View>
              )}
            </Field>
          )
        ) : null}

        <Button
          label={saving ? t.saving : isEdit ? t.saveDraft : t.createDraft}
          loading={saving}
          disabled={!valid}
          onPress={save}
        />
      </ScrollView>
    </View>
  );
}
