import { useTranslation } from "@repo/i18n";
import type { AttendanceStatusKey } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput } from "react-native";

import { ScreenScaffold, StatusPicker } from "../../../../components/attendance-ui";
import { trpc } from "../../../../lib/trpc";

/**
 * Submit an attendance correction request (ADR-011 §8 — immutable request; the
 * record changes only when an admin approves it on the web). The current status
 * arrives as a param from the calendar row; the actor picks the requested status
 * and a reason.
 */
export default function SubmitCorrectionScreen() {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const router = useRouter();
  const { recordId, currentStatus } = useLocalSearchParams<{
    recordId: string;
    currentStatus?: AttendanceStatusKey;
  }>();
  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatusKey>(
    currentStatus === "PRESENT" ? "ABSENT" : "PRESENT",
  );
  const [reason, setReason] = useState("");

  const submit = trpc.attendanceCorrection.submit.useMutation({
    onSuccess: () => {
      router.back();
    },
  });

  return (
    <ScreenScaffold title={t.requestCorrection}>
      {currentStatus ? (
        <Text className="text-sm text-muted-foreground">
          {t.current} {currentStatus}
        </Text>
      ) : null}

      <Text className="text-sm font-medium text-muted-foreground">{t.requestedStatus}</Text>
      <StatusPicker value={requestedStatus} onChange={setRequestedStatus} />

      <Text className="text-sm font-medium text-muted-foreground">{t.reason}</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t.whyChange}
        multiline
        className="min-h-11 rounded-md border border-border bg-card px-3 py-2 text-foreground"
      />

      <Pressable
        accessibilityRole="button"
        disabled={submit.isPending || reason.trim().length === 0 || recordId === undefined}
        onPress={() => {
          if (recordId === undefined) {
            return;
          }
          submit.mutate({ attendanceRecordId: recordId, requestedStatus, reason: reason.trim() });
        }}
        className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
      >
        <Text className="font-medium text-primary-foreground">{t.submitRequest}</Text>
      </Pressable>
      {submit.isError ? (
        <Text className="text-sm text-destructive">{submit.error.message}</Text>
      ) : null}
    </ScreenScaffold>
  );
}
