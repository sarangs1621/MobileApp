import { useTranslation } from "@repo/i18n";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ListRow } from "../../../components/academic-list";
import { LEAVE_STATUS_CLASS, ScreenScaffold, todayIst } from "../../../components/attendance-ui";
import { Button } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const eyebrow = "font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500";
const inputClass =
  "rounded-[10px] border border-subtle bg-white px-3 py-2.5 font-sans text-body text-neutral-900";

/**
 * Parent leave: pick a child, see their leave requests + status, and apply for
 * new leave (ADR-011 §7 — approval is an admin action; parents apply and cancel
 * their own PENDING requests). Dates are plain YYYY-MM-DD, validated server-side.
 */
export default function LeaveScreen() {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const children = trpc.student.list.useQuery();
  const [studentId, setStudentId] = useState<string | null>(null);

  return (
    <ScreenScaffold title={t.leaveRequests}>
      <Text className={eyebrow}>{t.child}</Text>
      {children.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : (children.data ?? []).length === 0 ? (
        <Text className="font-sans text-sm text-neutral-500">{t.noChildrenLinked}</Text>
      ) : (
        (children.data ?? []).map((child) => {
          const selected = child.id === studentId;
          return (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setStudentId(child.id);
              }}
              className={`min-h-12 justify-center rounded-xl border px-4 ${
                selected ? "border-primary-600 bg-primary-50" : "border-subtle bg-card"
              }`}
            >
              <Text
                className={`font-sans font-semibold ${
                  selected ? "text-primary-800" : "text-neutral-900"
                }`}
              >
                {child.firstName} {child.lastName}
              </Text>
            </Pressable>
          );
        })
      )}

      {studentId ? <ChildLeave studentId={studentId} /> : null}
    </ScreenScaffold>
  );
}

/** Leave list + apply form for the selected child's ACTIVE enrollment. */
function ChildLeave({ studentId }: { studentId: string }) {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const utils = trpc.useUtils();
  const enrollments = trpc.enrollment.listByStudent.useQuery({ studentId });
  const enrollmentId = (enrollments.data ?? []).find((e) => e.status === "ACTIVE")?.id;

  const leaves = trpc.leave.listByEnrollment.useQuery(
    { enrollmentId: enrollmentId ?? "" },
    { enabled: enrollmentId !== undefined },
  );

  const [fromDate, setFromDate] = useState(todayIst());
  const [toDate, setToDate] = useState(todayIst());
  const [reason, setReason] = useState("");

  const invalidate = () => {
    if (enrollmentId !== undefined) {
      void utils.leave.listByEnrollment.invalidate({ enrollmentId });
    }
  };
  const create = trpc.leave.create.useMutation({
    onSuccess: () => {
      setReason("");
      invalidate();
    },
  });
  const cancel = trpc.leave.cancel.useMutation({ onSuccess: invalidate });

  if (enrollments.isLoading) {
    return <ActivityIndicator color="#7A3414" />;
  }
  if (enrollmentId === undefined) {
    return <Text className="font-sans text-sm text-neutral-500">{t.noActiveEnrollment}</Text>;
  }

  return (
    <View className="gap-3">
      <Text className={eyebrow}>{t.applyForLeave}</Text>
      <DateField label={t.from} value={fromDate} onChange={setFromDate} />
      <DateField label={t.to} value={toDate} onChange={setToDate} />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t.reason}
        placeholderTextColor="#948676"
        multiline
        textAlignVertical="top"
        className={`${inputClass} min-h-16`}
      />
      <Button
        label={t.submitRequest}
        loading={create.isPending}
        disabled={reason.trim().length === 0}
        onPress={() => {
          create.mutate({ enrollmentId, fromDate, toDate, reason: reason.trim() });
        }}
      />
      {create.isError ? (
        <Text className="font-sans text-sm text-danger-600">{create.error.message}</Text>
      ) : null}

      <Text className={eyebrow}>{t.requests}</Text>
      {leaves.isLoading ? (
        <ActivityIndicator color="#7A3414" />
      ) : (leaves.data ?? []).length === 0 ? (
        <Text className="font-sans text-sm text-neutral-500">{t.noLeaveRequests}</Text>
      ) : (
        (leaves.data ?? []).map((leave) => (
          <ListRow key={leave.id}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                {leave.fromDate} → {leave.toDate}
              </Text>
              <Text
                className={`font-sans text-sm font-semibold ${LEAVE_STATUS_CLASS[leave.status]}`}
              >
                {leave.status}
              </Text>
            </View>
            <Text className="font-sans text-sm text-neutral-500">{leave.reason}</Text>
            {leave.status === "PENDING" ? (
              <Pressable
                accessibilityRole="button"
                disabled={cancel.isPending}
                onPress={() => {
                  cancel.mutate({ leaveId: leave.id });
                }}
              >
                <Text className="font-sans text-sm font-semibold text-danger-600">{t.cancel}</Text>
              </Pressable>
            ) : null}
          </ListRow>
        ))
      )}
    </View>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="w-12 font-sans text-sm text-neutral-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#948676"
        autoCapitalize="none"
        className={`${inputClass} flex-1`}
      />
    </View>
  );
}
