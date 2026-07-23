import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import { useTranslation } from "@repo/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";

import {
  AttachmentList,
  formatDate,
  Loading,
  SCOPE_LABEL,
  STATUS_LABEL,
} from "../../../components/announcements-ui";
import { Header } from "../../../components/behaviour-ui";
import { Button, StatusChip } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Announcement detail (M11 Step 6). View title/body/scope + attachment downloads.
 * Author actions are permission + lifecycle gated: publish/archive are admin-only;
 * edit/delete apply to a DRAFT the author owns (the service is the real gate).
 */
export default function AnnouncementDetailScreen() {
  const { dict } = useTranslation();
  const t = dict.announcements;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const role = trpc.auth.me.useQuery().data?.role;
  const canManage = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_MANAGE);
  const canDraft = role !== undefined && can(role, PERMISSIONS.ANNOUNCEMENT_DRAFT);

  const query = trpc.announcement.get.useQuery({ id }, { enabled: !!id });
  const a = query.data;
  const download = trpc.announcement.attachmentDownloadUrl.useMutation();

  const refresh = () => {
    void utils.announcement.list.invalidate();
    void utils.announcement.get.invalidate({ id });
  };
  const publish = trpc.announcement.publish.useMutation({ onSuccess: refresh });
  const archive = trpc.announcement.archive.useMutation({ onSuccess: refresh });
  const remove = trpc.announcement.delete.useMutation({
    onSuccess: () => {
      void utils.announcement.list.invalidate();
      router.back();
    },
  });

  if (query.isLoading || !a) {
    return (
      <View className="flex-1 bg-neutral-50">
        <Header title={t.detailTitle} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  const isDraft = a.status === "DRAFT";
  const isPublished = a.status === "PUBLISHED";
  const canEdit = isDraft && (canManage || canDraft);

  const confirmDelete = () =>
    Alert.alert(t.deleteDraftConfirmTitle, t.cannotBeUndone, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: () => remove.mutate({ id }) },
    ]);

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title={t.detailTitle} onBack={() => router.back()} />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <View className="gap-2">
          <Text className="font-display text-display text-neutral-900">{a.title}</Text>
          <View className="flex-row items-center gap-2">
            <StatusChip status={a.status} label={STATUS_LABEL[a.status]} dot />
            <Text className="font-sans text-caption text-neutral-500">
              {SCOPE_LABEL[a.scope]} · {formatDate(a.publishedAt ?? a.createdAt)}
            </Text>
          </View>
        </View>

        <Text className="font-sans text-body leading-6 text-neutral-800">{a.body}</Text>

        <AttachmentList
          attachments={a.attachments}
          onMint={(attachmentId) => download.mutateAsync({ attachmentId })}
        />

        <View className="gap-2 pt-2">
          {canEdit ? (
            <Button
              variant="secondary"
              label={t.editDraft}
              onPress={() => router.push(`/announcements/new?id=${id}`)}
            />
          ) : null}
          {isDraft && canManage ? (
            <Button
              label={t.publish}
              loading={publish.isPending}
              onPress={() => publish.mutate({ id })}
            />
          ) : null}
          {isPublished && canManage ? (
            <Button
              variant="secondary"
              label={t.archive}
              loading={archive.isPending}
              onPress={() => archive.mutate({ id })}
            />
          ) : null}
          {canEdit ? (
            <Button variant="destructive" label={t.deleteDraft} onPress={confirmDelete} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
