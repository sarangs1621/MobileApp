import { PERMISSIONS } from "@repo/constants";
import { can } from "@repo/core";
import type { EnrollmentStatusKey, StudentRelationshipKey } from "@repo/types";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ListRow } from "../../../../components/academic-list";
import { Header } from "../../../../components/behaviour-ui";
import { Avatar, StatusChip, titleCase, type Tone } from "../../../../components/ui";
import { trpc } from "../../../../lib/trpc";

const ENROLLMENT_TONE: Record<EnrollmentStatusKey, Tone> = {
  ADMITTED: "info",
  ACTIVE: "success",
  PROMOTED: "neutral",
  RETAINED: "neutral",
  TRANSFERRED: "neutral",
  DROPPED: "danger",
  ALUMNI: "neutral",
};

const RELATIONSHIP_LABEL: Record<StudentRelationshipKey, string> = {
  FATHER: "Father",
  MOTHER: "Mother",
  GUARDIAN: "Guardian",
  EMERGENCY_CONTACT: "Emergency contact",
};

/**
 * Read-only student profile (M3 — manage on web): identity, enrollment history
 * (ADR-010 — one row per year, never mutated), and guardians. The service enforces
 * row scope. Year/class/section names come ENRICHED on the enrollment rows (server-side
 * join, parent-safe — no academic:read needed; ADR-016 / F5) — no client lookup maps.
 */
export default function StudentProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = trpc.auth.me.useQuery();
  const role = me.data?.role;
  const canReadParents = role !== undefined && can(role, PERMISSIONS.PARENT_READ);
  const canReadAttendance = role !== undefined && can(role, PERMISSIONS.ATTENDANCE_READ);
  const canReadBehaviour = role !== undefined && can(role, PERMISSIONS.BEHAVIOUR_READ);

  const enabled = id !== undefined;
  const student = trpc.student.get.useQuery({ id: id ?? "" }, { enabled });
  const enrollments = trpc.enrollment.listByStudent.useQuery({ studentId: id ?? "" }, { enabled });
  const guardians = trpc.parent.guardians.useQuery({ studentId: id ?? "" }, { enabled });
  const parents = trpc.parent.list.useQuery(undefined, { enabled: canReadParents });

  const parentName = new Map((parents.data ?? []).map((p) => [p.id, p.name]));

  return (
    <View className="flex-1 bg-neutral-50">
      <Header title="Student profile" onBack={() => router.back()} />

      {student.isError ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center font-sans text-danger-600">
            Couldn’t load this student. You may not have access, or the server is unreachable.
          </Text>
        </View>
      ) : student.isLoading || student.data === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7A3414" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="p-4 gap-3">
          <ListRow>
            <View className="flex-row items-center gap-3">
              <Avatar name={`${student.data.firstName} ${student.data.lastName}`} size="lg" />
              <View className="flex-1">
                <Text className="font-display text-title text-neutral-900">
                  {student.data.firstName} {student.data.lastName}
                </Text>
                <Text className="font-sans text-sm text-neutral-500">
                  Admission no {student.data.admissionNo}
                </Text>
              </View>
              <StatusChip status={student.data.status} label={titleCase(student.data.status)} dot />
            </View>
            <View className="mt-3 gap-2">
              <Field label="Date of birth" value={student.data.dob} />
              <Field label="Gender" value={student.data.gender} />
              <Field label="Blood group" value={student.data.bloodGroup} />
              <Field label="Nationality" value={student.data.nationality} />
              <Field label="Address" value={student.data.address} />
            </View>
          </ListRow>

          {canReadBehaviour ? (
            <Link
              href={{
                pathname: "/behaviour/student/[studentId]",
                params: { studentId: student.data.id },
              }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                className="min-h-12 justify-center rounded-xl border border-subtle bg-white px-4 active:bg-primary-50"
              >
                <Text className="font-sans font-semibold text-primary-700">
                  Behaviour incidents
                </Text>
              </Pressable>
            </Link>
          ) : null}

          <Text className="mt-1 font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
            Enrollment history
          </Text>
          {enrollments.data === undefined ? (
            <ActivityIndicator color="#7A3414" />
          ) : enrollments.data.length === 0 ? (
            <Text className="font-sans text-sm text-neutral-500">No enrollments yet.</Text>
          ) : (
            enrollments.data.map((enrollment) => (
              <ListRow key={enrollment.id}>
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                    {enrollment.academicYearName}
                  </Text>
                  <StatusChip
                    tone={ENROLLMENT_TONE[enrollment.status]}
                    label={titleCase(enrollment.status)}
                    dot
                  />
                </View>
                <Text className="font-sans text-sm text-neutral-500">
                  {enrollment.className}
                  {enrollment.sectionId
                    ? ` · Section ${enrollment.sectionName ?? "—"}`
                    : " · No section"}
                  {enrollment.rollNo != null ? ` · Roll ${enrollment.rollNo}` : ""}
                </Text>
                {canReadAttendance ? (
                  <Link
                    href={{
                      pathname: "/attendance/enrollment/[enrollmentId]",
                      params: {
                        enrollmentId: enrollment.id,
                        academicYearId: enrollment.academicYearId,
                      },
                    }}
                    asChild
                  >
                    <Pressable accessibilityRole="button">
                      <Text className="mt-1 font-sans text-sm font-semibold text-primary-700">
                        View attendance
                      </Text>
                    </Pressable>
                  </Link>
                ) : null}
              </ListRow>
            ))
          )}

          <Text className="mt-1 font-sans text-caption font-semibold uppercase tracking-eyebrow text-neutral-500">
            Guardians
          </Text>
          {guardians.data === undefined ? (
            <ActivityIndicator color="#7A3414" />
          ) : guardians.data.length === 0 ? (
            <Text className="font-sans text-sm text-neutral-500">No guardians linked.</Text>
          ) : (
            guardians.data.map((guardian) => {
              const label =
                parentName.get(guardian.parentId) ?? RELATIONSHIP_LABEL[guardian.relationship];
              return (
                <ListRow key={`${guardian.parentId}:${guardian.relationship}`}>
                  <View className="flex-row items-center gap-3">
                    <Avatar name={label} size="sm" />
                    <View className="flex-1">
                      <Text className="font-sans text-body font-semibold text-neutral-900">
                        {label}
                      </Text>
                      <Text className="font-sans text-sm text-neutral-500">
                        {RELATIONSHIP_LABEL[guardian.relationship]}
                        {guardian.isPrimary ? " · Primary contact" : ""}
                      </Text>
                    </View>
                  </View>
                </ListRow>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Label/value line inside the identity card. Absent optionals render "—". */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="font-sans text-sm text-neutral-500">{label}</Text>
      <Text className="flex-1 text-right font-sans text-sm text-neutral-900">{value ?? "—"}</Text>
    </View>
  );
}
