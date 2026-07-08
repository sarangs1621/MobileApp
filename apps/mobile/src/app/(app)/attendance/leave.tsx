import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ListRow } from "../../../components/academic-list";
import { LEAVE_STATUS_CLASS, ScreenScaffold, todayIst } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

/**
 * Parent leave: pick a child, see their leave requests + status, and apply for
 * new leave (ADR-011 §7 — approval is an admin action; parents apply and cancel
 * their own PENDING requests). Dates are plain YYYY-MM-DD, validated server-side.
 */
export default function LeaveScreen() {
  const children = trpc.student.list.useQuery();
  const [studentId, setStudentId] = useState<string | null>(null);

  return (
    <ScreenScaffold title="Leave requests">
      <Text className="text-sm font-medium text-muted-foreground">Child</Text>
      {children.isLoading ? (
        <ActivityIndicator />
      ) : (children.data ?? []).length === 0 ? (
        <Text className="text-sm text-muted-foreground">No children linked to you.</Text>
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
              className={`min-h-11 justify-center rounded-md border px-4 py-3 ${
                selected ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <Text className={`font-medium ${selected ? "text-primary" : "text-foreground"}`}>
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
    return <ActivityIndicator />;
  }
  if (enrollmentId === undefined) {
    return <Text className="text-sm text-muted-foreground">This child has no active enrollment.</Text>;
  }

  return (
    <View className="gap-3">
      <Text className="text-sm font-medium text-muted-foreground">Apply for leave</Text>
      <DateField label="From" value={fromDate} onChange={setFromDate} />
      <DateField label="To" value={toDate} onChange={setToDate} />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason"
        multiline
        className="min-h-11 rounded-md border border-border bg-card px-3 py-2 text-foreground"
      />
      <Pressable
        accessibilityRole="button"
        disabled={create.isPending || reason.trim().length === 0}
        onPress={() => {
          create.mutate({ enrollmentId, fromDate, toDate, reason: reason.trim() });
        }}
        className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
      >
        <Text className="font-medium text-primary-foreground">Submit request</Text>
      </Pressable>
      {create.isError ? (
        <Text className="text-sm text-destructive">{create.error.message}</Text>
      ) : null}

      <Text className="text-sm font-medium text-muted-foreground">Requests</Text>
      {leaves.isLoading ? (
        <ActivityIndicator />
      ) : (leaves.data ?? []).length === 0 ? (
        <Text className="text-sm text-muted-foreground">No leave requests yet.</Text>
      ) : (
        (leaves.data ?? []).map((leave) => (
          <ListRow key={leave.id}>
            <Text className="font-medium text-foreground">
              {leave.fromDate} → {leave.toDate}
            </Text>
            <Text className="text-sm text-muted-foreground">{leave.reason}</Text>
            <Text className={`text-sm font-medium ${LEAVE_STATUS_CLASS[leave.status]}`}>
              {leave.status}
            </Text>
            {leave.status === "PENDING" ? (
              <Pressable
                accessibilityRole="button"
                disabled={cancel.isPending}
                onPress={() => {
                  cancel.mutate({ leaveId: leave.id });
                }}
              >
                <Text className="text-sm text-destructive">Cancel</Text>
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
      <Text className="w-12 text-sm text-muted-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        className="min-h-11 flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground"
      />
    </View>
  );
}
