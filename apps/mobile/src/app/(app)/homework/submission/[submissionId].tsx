import { useTranslation } from "@repo/i18n";
import type { SubmissionStatusKey } from "@repo/types";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ScreenScaffold } from "../../../../components/attendance-ui";
import {
  AttachmentList,
  SUB_STATUS_CLASS,
  SUB_STATUS_LABEL,
} from "../../../../components/homework-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * Submission detail (M6, mobile), role-aware. Everyone in scope sees the note,
 * parent files, and the feedback history. A teacher/admin also gets the review form
 * on a SUBMITTED submission: return (changes requested) or accept, with a required
 * feedback body — one guarded transaction in the service.
 */
export default function SubmissionDetailScreen() {
  const { dict } = useTranslation();
  const tr = dict.homework;
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const id = submissionId ?? "";
  const me = trpc.auth.me.useQuery();
  const isParent = me.data?.role === "PARENT";
  const utils = trpc.useUtils();

  const sub = trpc.submission.get.useQuery({ submissionId: id }, { enabled: id !== "" });
  const files = trpc.submission.attachments.useQuery({ submissionId: id }, { enabled: id !== "" });
  const feedback = trpc.submission.feedback.useQuery({ submissionId: id }, { enabled: id !== "" });
  const dl = trpc.submission.attachmentDownloadUrl.useMutation();

  const [decision, setDecision] =
    useState<Extract<SubmissionStatusKey, "RETURNED" | "REVIEWED">>("RETURNED");
  const [body, setBody] = useState("");
  const review = trpc.submission.review.useMutation({
    onSuccess: () => {
      setBody("");
      void utils.submission.get.invalidate({ submissionId: id });
      void utils.submission.feedback.invalidate({ submissionId: id });
    },
  });

  if (sub.isLoading) {
    return (
      <ScreenScaffold title={tr.submission}>
        <ActivityIndicator color="#7A3414" />
      </ScreenScaffold>
    );
  }
  if (sub.data === undefined) {
    return (
      <ScreenScaffold title={tr.submission}>
        <Text className="font-sans text-neutral-500">{tr.submissionNotFound}</Text>
      </ScreenScaffold>
    );
  }
  const s = sub.data;
  const canReview = !isParent && s.status === "SUBMITTED";
  const eyebrow =
    "font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500";
  const inputClass =
    "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

  return (
    <ScreenScaffold title={tr.submission}>
      <View className="gap-1 rounded-card border border-subtle bg-card p-4 shadow-sm">
        <Text className="font-sans text-body font-semibold text-neutral-900">
          {tr.attempt(s.attempt)} ·{" "}
          <Text className={SUB_STATUS_CLASS[s.status]}>{SUB_STATUS_LABEL[s.status]}</Text>
          {s.isLate ? tr.lateSuffix : ""}
        </Text>
        {s.note ? (
          <Text className="mt-1 font-sans text-body text-neutral-800">{s.note}</Text>
        ) : null}
      </View>

      <Text className={eyebrow}>{tr.files}</Text>
      <AttachmentList
        attachments={files.data ?? []}
        onMint={(attachmentId) => dl.mutateAsync({ attachmentId })}
        emptyHint={tr.noFiles}
      />

      <Text className={eyebrow}>{tr.feedback}</Text>
      {(feedback.data ?? []).length === 0 ? (
        <Text className="font-sans text-sm text-neutral-500">{tr.noFeedback}</Text>
      ) : (
        (feedback.data ?? []).map((f) => (
          <View
            key={f.id}
            className="gap-1 rounded-card border border-subtle bg-card p-3 shadow-sm"
          >
            <Text className="font-sans text-caption text-neutral-500">
              {tr.attempt(f.attempt)} · {SUB_STATUS_LABEL[f.decision]}
            </Text>
            <Text className="font-sans text-body text-neutral-800">{f.body}</Text>
          </View>
        ))
      )}

      {canReview ? (
        <View className="gap-2">
          <Text className={eyebrow}>{tr.review}</Text>
          <View className="flex-row gap-2">
            {(["RETURNED", "REVIEWED"] as const).map((d) => {
              const on = d === decision;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setDecision(d)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-pill border px-3 ${
                    on ? "border-primary-600 bg-primary-50" : "border-subtle bg-white"
                  }`}
                >
                  <Text
                    className={`font-sans text-sm font-semibold ${
                      on ? "text-primary-800" : "text-neutral-500"
                    }`}
                  >
                    {d === "RETURNED" ? tr.requestChanges : tr.accept}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={tr.feedback}
            placeholderTextColor="#948676"
            multiline
            textAlignVertical="top"
            className={`${inputClass} min-h-20`}
          />
          <Pressable
            accessibilityRole="button"
            disabled={review.isPending || body.trim() === ""}
            onPress={() => review.mutate({ submissionId: id, decision, body: body.trim() })}
            className={`min-h-12 items-center justify-center rounded-pill px-4 ${
              review.isPending || body.trim() === ""
                ? "bg-neutral-200"
                : "bg-primary-600 active:bg-primary-700"
            }`}
          >
            <Text
              className={`font-sans font-semibold ${
                review.isPending || body.trim() === "" ? "text-neutral-400" : "text-neutral-50"
              }`}
            >
              {tr.submitReview}
            </Text>
          </Pressable>
          {review.isError ? (
            <Text className="font-sans text-sm text-danger-600">{review.error.message}</Text>
          ) : null}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}
