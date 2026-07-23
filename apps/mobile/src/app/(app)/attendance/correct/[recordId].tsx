import { useTranslation } from "@repo/i18n";
import type { AttendanceStatusKey } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput } from "react-native";

import { ScreenScaffold, StatusPicker } from "../../../../components/attendance-ui";
import { Button } from "../../../../components/ui";
import { trpc } from "../../../../lib/trpc";

const eyebrow = "font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500";

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
        <Text className="font-sans text-sm text-neutral-500">
          {t.current} {currentStatus}
        </Text>
      ) : null}

      <Text className={eyebrow}>{t.requestedStatus}</Text>
      <StatusPicker value={requestedStatus} onChange={setRequestedStatus} />

      <Text className={eyebrow}>{t.reason}</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t.whyChange}
        placeholderTextColor="#948676"
        multiline
        textAlignVertical="top"
        className="min-h-16 rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900"
      />

      <Button
        label={t.submitRequest}
        loading={submit.isPending}
        disabled={reason.trim().length === 0 || recordId === undefined}
        onPress={() => {
          if (recordId === undefined) {
            return;
          }
          submit.mutate({ attendanceRecordId: recordId, requestedStatus, reason: reason.trim() });
        }}
      />
      {submit.isError ? (
        <Text className="font-sans text-sm text-danger-600">{submit.error.message}</Text>
      ) : null}
    </ScreenScaffold>
  );
}
