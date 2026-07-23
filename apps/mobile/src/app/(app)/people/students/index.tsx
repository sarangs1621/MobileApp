import type { StudentStatusKey } from "@repo/types";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { AcademicListScreen, ListRow } from "../../../../components/academic-list";
import { Avatar, StatusChip, titleCase, type Tone } from "../../../../components/ui";
import { trpc } from "../../../../lib/trpc";

const STATUS_TONE: Record<StudentStatusKey, Tone> = {
  ACTIVE: "success",
  ARCHIVED: "neutral",
  GRADUATED: "info",
  WITHDRAWN: "danger",
};

/**
 * Read-only students list (M3 — manage on web). Row scope is applied by the
 * service: teachers see students enrolled in sections they teach, parents see
 * only their own children, admins see the whole school.
 */
export default function StudentsScreen() {
  const students = trpc.student.list.useQuery();

  return (
    <AcademicListScreen
      title="Students"
      isLoading={students.isLoading}
      isError={students.isError}
      items={students.data}
      keyExtractor={(student) => student.id}
      emptyText="No students visible to you."
      renderItem={(student) => {
        const name = `${student.firstName} ${student.lastName}`;
        return (
          <Link href={{ pathname: "/people/students/[id]", params: { id: student.id } }} asChild>
            <Pressable accessibilityRole="button">
              <ListRow>
                <View className="flex-row items-center gap-3">
                  <Avatar name={name} />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
                        {name}
                      </Text>
                      <StatusChip
                        tone={STATUS_TONE[student.status]}
                        label={titleCase(student.status)}
                        dot
                      />
                    </View>
                    <Text className="font-sans text-sm text-neutral-500">
                      Admission no {student.admissionNo}
                    </Text>
                  </View>
                </View>
              </ListRow>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
