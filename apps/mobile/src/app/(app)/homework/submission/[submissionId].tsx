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
        <ActivityIndicator />
      </ScreenScaffold>
    );
  }
  if (sub.data === undefined) {
    return (
      <ScreenScaffold title={tr.submission}>
        <Text className="text-muted-foreground">{tr.submissionNotFound}</Text>
      </ScreenScaffold>
    );
  }
  const s = sub.data;
  const canReview = !isParent && s.status === "SUBMITTED";

  return (
    <ScreenScaffold title={tr.submission}>
      <View className="gap-1 rounded-md border border-border bg-card p-4">
        <Text className="font-medium text-foreground">
          {tr.attempt(s.attempt)} ·{" "}
          <Text className={SUB_STATUS_CLASS[s.status]}>{SUB_STATUS_LABEL[s.status]}</Text>
          {s.isLate ? tr.lateSuffix : ""}
        </Text>
        {s.note ? <Text className="mt-1 text-foreground">{s.note}</Text> : null}
      </View>

      <Text className="text-sm font-medium text-muted-foreground">{tr.files}</Text>
      <AttachmentList
        attachments={files.data ?? []}
        onMint={(attachmentId) => dl.mutateAsync({ attachmentId })}
        emptyHint={tr.noFiles}
      />

      <Text className="text-sm font-medium text-muted-foreground">{tr.feedback}</Text>
      {(feedback.data ?? []).length === 0 ? (
        <Text className="text-sm text-muted-foreground">{tr.noFeedback}</Text>
      ) : (
        (feedback.data ?? []).map((f) => (
          <View key={f.id} className="gap-1 rounded-md border border-border bg-card p-3">
            <Text className="text-xs text-muted-foreground">
              {tr.attempt(f.attempt)} · {SUB_STATUS_LABEL[f.decision]}
            </Text>
            <Text className="text-foreground">{f.body}</Text>
          </View>
        ))
      )}

      {canReview ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-muted-foreground">{tr.review}</Text>
          <View className="flex-row gap-2">
            {(["RETURNED", "REVIEWED"] as const).map((d) => {
              const on = d === decision;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setDecision(d)}
                  className={`min-h-11 flex-1 items-center justify-center rounded-md border px-3 py-2 ${
                    on ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${on ? "text-primary" : "text-foreground"}`}
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
            multiline
            className="min-h-20 rounded-md border border-border px-3 py-2 text-foreground"
          />
          <Pressable
            accessibilityRole="button"
            disabled={review.isPending || body.trim() === ""}
            onPress={() => review.mutate({ submissionId: id, decision, body: body.trim() })}
            className={`min-h-11 items-center justify-center rounded-md px-4 py-3 ${
              review.isPending || body.trim() === "" ? "bg-primary/40" : "bg-primary"
            }`}
          >
            <Text className="font-medium text-primary-foreground">{tr.submitReview}</Text>
          </Pressable>
          {review.isError ? (
            <Text className="text-sm text-destructive">{review.error.message}</Text>
          ) : null}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}
