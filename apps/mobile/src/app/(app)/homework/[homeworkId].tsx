import { useTranslation } from "@repo/i18n";
import type { HomeworkChildContextDto } from "@repo/types";
import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { AttachmentList, HW_STATUS_LABEL, SUB_STATUS_LABEL } from "../../../components/homework-ui";
import { StatusChip } from "../../../components/ui";
import {
  pickDocument,
  pickImage,
  uploadSubmissionFile,
  type AttachmentMeta,
  type PickedFile,
} from "../../../lib/attachments";
import { trpc } from "../../../lib/trpc";

const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";
const eyebrow = "font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500";

/**
 * Homework detail (M6, mobile), role-aware. Teacher/admin: lifecycle actions
 * (publish/close/reopen/delete) + a link to the review queue. Parent: teacher files
 * + a per-child submit/resubmit (note-only on mobile — files on web) with a link to
 * each submission's feedback. Attachments open via a signed URL.
 */
export default function HomeworkDetailScreen() {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const { homeworkId } = useLocalSearchParams<{ homeworkId: string }>();
  const id = homeworkId ?? "";
  const me = trpc.auth.me.useQuery();
  const isParent = me.data?.role === "PARENT";

  const hw = trpc.homework.get.useQuery({ homeworkId: id }, { enabled: id !== "" });
  const attachments = trpc.homework.attachments.useQuery(
    { homeworkId: id },
    { enabled: id !== "" },
  );
  const dl = trpc.homework.attachmentDownloadUrl.useMutation();

  if (hw.isLoading) {
    return (
      <ScreenScaffold title={tr.title}>
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }
  if (hw.data === undefined) {
    return (
      <ScreenScaffold title={tr.title}>
        <Text className="font-sans text-neutral-500">{tr.notFound}</Text>
      </ScreenScaffold>
    );
  }
  const h = hw.data;

  return (
    <ScreenScaffold title={tr.title}>
      <View className="gap-1.5 rounded-card border border-subtle bg-card p-4 shadow-sm">
        <Text className="font-display text-title text-neutral-900">{h.title}</Text>
        <View className="flex-row items-center gap-2">
          <StatusChip status={h.status} label={HW_STATUS_LABEL[h.status]} dot />
          <Text className="font-sans text-sm text-neutral-500">
            {tr.due} {h.dueDate}
          </Text>
        </View>
        {h.description ? (
          <Text className="mt-1 font-sans text-body text-neutral-800">{h.description}</Text>
        ) : null}
      </View>

      <Text className={eyebrow}>{tr.teacherFiles}</Text>
      <AttachmentList
        attachments={attachments.data ?? []}
        onMint={(attachmentId) => dl.mutateAsync({ attachmentId })}
        emptyHint={tr.noFilesAttached}
      />

      {isParent ? (
        <ParentSubmit homeworkId={id} canSubmit={h.status === "PUBLISHED"} />
      ) : (
        <TeacherActions homeworkId={id} status={h.status} />
      )}
    </ScreenScaffold>
  );
}

function TeacherActions({ homeworkId, status }: { homeworkId: string; status: string }) {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const utils = trpc.useUtils();
  const [reason, setReason] = useState("");
  const invalidate = () => {
    void utils.homework.get.invalidate({ homeworkId });
    void utils.homework.list.invalidate();
  };
  const publish = trpc.homework.publish.useMutation({ onSuccess: invalidate });
  const close = trpc.homework.close.useMutation({ onSuccess: invalidate });
  const reopen = trpc.homework.reopen.useMutation({ onSuccess: invalidate });
  const remove = trpc.homework.delete.useMutation({ onSuccess: invalidate });
  const err = publish.error ?? close.error ?? reopen.error ?? remove.error;

  return (
    <View className="gap-2">
      <Link
        href={{ pathname: "/homework/[homeworkId]/submissions", params: { homeworkId } }}
        asChild
      >
        <Pressable
          accessibilityRole="button"
          className="min-h-12 items-center justify-center rounded-pill border border-strong bg-white px-4 active:bg-primary-50"
        >
          <Text className="font-sans font-semibold text-primary-700">{tr.reviewSubmissions}</Text>
        </Pressable>
      </Link>

      {status === "DRAFT" ? (
        <>
          <ActionButton
            label={tr.publish}
            primary
            pending={publish.isPending}
            onPress={() => publish.mutate({ homeworkId })}
          />
          <ActionButton
            label={tr.deleteDraft}
            destructive
            pending={remove.isPending}
            onPress={() => remove.mutate({ homeworkId })}
          />
        </>
      ) : null}
      {status === "PUBLISHED" ? (
        <ActionButton
          label={tr.close}
          pending={close.isPending}
          onPress={() => close.mutate({ homeworkId })}
        />
      ) : null}
      {status === "CLOSED" ? (
        <>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={tr.reasonToReopen}
            placeholderTextColor="#948676"
            className={inputClass}
          />
          <ActionButton
            label={tr.reopen}
            pending={reopen.isPending}
            disabled={reason.trim() === ""}
            onPress={() => reopen.mutate({ homeworkId, reason: reason.trim() })}
          />
        </>
      ) : null}
      {err ? <Text className="font-sans text-sm text-danger-600">{err.message}</Text> : null}
    </View>
  );
}

function ParentSubmit({ homeworkId, canSubmit }: { homeworkId: string; canSubmit: boolean }) {
  const { dict } = useTranslation();
  const ctxQuery = trpc.submission.childContext.useQuery({ homeworkId });
  const rows = ctxQuery.data ?? [];

  if (ctxQuery.isLoading) {
    return <ActivityIndicator color="#7A3414" />;
  }
  if (rows.length === 0) {
    return <Text className="font-sans text-neutral-500">{dict.homework.notForYourChildren}</Text>;
  }
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <ChildSubmitCard
          key={row.studentId}
          homeworkId={homeworkId}
          row={row}
          canSubmit={canSubmit}
        />
      ))}
    </View>
  );
}

function ChildSubmitCard({
  homeworkId,
  row,
  canSubmit,
}: {
  homeworkId: string;
  row: HomeworkChildContextDto;
  canSubmit: boolean;
}) {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const onDone = () => {
    setNote("");
    setFiles([]);
    void utils.submission.childContext.invalidate({ homeworkId });
  };
  const submit = trpc.submission.submit.useMutation({ onSuccess: onDone });
  const resubmit = trpc.submission.resubmit.useMutation({ onSuccess: onDone });
  const mintUpload = trpc.submission.attachmentUploadUrl.useMutation();
  const sub = row.submission;
  const isResubmit = sub !== null;
  const reviewed = sub?.status === "REVIEWED";
  const attempt = sub ? sub.attempt + 1 : 1;
  const pending = submit.isPending || resubmit.isPending || uploading;
  const err = submit.error ?? resubmit.error;
  // Can act only with an ACTIVE-in-section enrollment, homework PUBLISHED, not yet REVIEWED.
  const actionable = canSubmit && row.enrollmentId !== null && !reviewed;
  // Server rule: a submission needs a note OR at least one attachment.
  const canSend = note.trim() !== "" || files.length > 0;

  const addFile = (pick: () => Promise<PickedFile | null>) => async () => {
    setUploadErr(null);
    try {
      const file = await pick();
      if (file) {
        setFiles((prev) => (prev.length >= 10 ? prev : [...prev, file]));
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : tr.couldNotAddFile);
    }
  };

  const onSend = async () => {
    if (row.enrollmentId === null) {
      return;
    }
    setUploadErr(null);
    let attachments: AttachmentMeta[] = [];
    try {
      setUploading(true);
      attachments = await Promise.all(
        files.map((file) =>
          uploadSubmissionFile(file, (meta) =>
            mintUpload
              .mutateAsync({ homeworkId, enrollmentId: row.enrollmentId!, attempt, ...meta })
              .then((r) => ({ storagePath: r.storagePath, token: r.token })),
          ),
        ),
      );
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : tr.fileUploadFailed);
      return;
    } finally {
      setUploading(false);
    }
    const input = {
      homeworkId,
      enrollmentId: row.enrollmentId,
      note: note.trim() || null,
      attachments,
    };
    if (isResubmit) {
      resubmit.mutate(input);
    } else {
      submit.mutate(input);
    }
  };

  return (
    <View className="gap-2 rounded-card border border-subtle bg-card p-4 shadow-sm">
      <Text className="font-sans text-body font-semibold text-neutral-900">{row.studentName}</Text>
      {sub ? (
        <Text className="font-sans text-sm text-neutral-500">
          {tr.attempt(sub.attempt)} · {SUB_STATUS_LABEL[sub.status]}
          {sub.isLate ? tr.lateSuffix : ""}
        </Text>
      ) : (
        <Text className="font-sans text-sm text-neutral-500">{tr.notSubmitted}</Text>
      )}

      {sub ? (
        <Link
          href={{
            pathname: "/homework/submission/[submissionId]",
            params: { submissionId: sub.id },
          }}
          asChild
        >
          <Pressable accessibilityRole="button" className="min-h-9 justify-center">
            <Text className="font-sans text-sm font-semibold text-primary-700">
              {tr.viewSubmissionFeedback}
            </Text>
          </Pressable>
        </Link>
      ) : null}

      {actionable ? (
        <>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={isResubmit ? tr.noteResubmission : tr.addNote}
            placeholderTextColor="#948676"
            multiline
            textAlignVertical="top"
            className={`${inputClass} min-h-16`}
          />

          {files.map((file, i) => (
            <View
              key={`${file.uri}-${i}`}
              className="flex-row items-center justify-between rounded-xl border border-subtle bg-neutral-50 px-3 py-2"
            >
              <Text className="flex-1 font-sans text-sm text-neutral-900" numberOfLines={1}>
                {file.fileName}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Text className="font-sans text-sm font-semibold text-danger-600">{tr.remove}</Text>
              </Pressable>
            </View>
          ))}

          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={pending || files.length >= 10}
              onPress={addFile(pickImage)}
              className="min-h-11 flex-1 items-center justify-center rounded-pill border border-strong bg-white px-3 active:bg-primary-50"
            >
              <Text className="font-sans text-sm font-semibold text-primary-700">
                {tr.addPhoto}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={pending || files.length >= 10}
              onPress={addFile(pickDocument)}
              className="min-h-11 flex-1 items-center justify-center rounded-pill border border-strong bg-white px-3 active:bg-primary-50"
            >
              <Text className="font-sans text-sm font-semibold text-primary-700">{tr.addFile}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={pending || !canSend}
            onPress={() => {
              void onSend();
            }}
            className={`min-h-12 items-center justify-center rounded-pill px-4 ${
              pending || !canSend ? "bg-neutral-200" : "bg-primary-600 active:bg-primary-700"
            }`}
          >
            <Text
              className={`font-sans font-semibold ${
                pending || !canSend ? "text-neutral-400" : "text-neutral-50"
              }`}
            >
              {uploading ? tr.uploading : isResubmit ? tr.resubmit : tr.submit}
            </Text>
          </Pressable>
          <Text className="font-sans text-caption text-neutral-400">{tr.addNoteHint}</Text>
          {uploadErr ? (
            <Text className="font-sans text-sm text-danger-600">{uploadErr}</Text>
          ) : null}
        </>
      ) : reviewed ? (
        <Text className="font-sans text-sm text-success-600">{tr.reviewedNoChanges}</Text>
      ) : null}
      {err ? <Text className="font-sans text-sm text-danger-600">{err.message}</Text> : null}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  pending,
  disabled,
  primary,
  destructive,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
}) {
  const off = pending || disabled;
  const base = primary
    ? off
      ? "bg-neutral-200"
      : "bg-primary-600 active:bg-primary-700"
    : destructive
      ? "border border-danger-600 bg-white active:bg-danger-100"
      : "border border-strong bg-white active:bg-primary-50";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-pill px-4 ${base}`}
    >
      <Text
        className={`font-sans font-semibold ${
          primary
            ? off
              ? "text-neutral-400"
              : "text-neutral-50"
            : destructive
              ? "text-danger-600"
              : "text-primary-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
