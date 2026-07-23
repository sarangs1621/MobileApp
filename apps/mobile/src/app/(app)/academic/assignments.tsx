import { Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

/**
 * Read-only teacher-assignments list (M2 placeholder). Teachers see only their
 * own rows (the service applies the `ownsAssignment` scope); admins see all.
 * Subject/class/section names are resolved from the structure lists; the
 * teacher is shown as "You" or a user id — a people directory arrives in M3.
 */
export default function TeacherAssignmentsScreen() {
  const me = trpc.auth.me.useQuery();
  const assignments = trpc.teacherAssignment.list.useQuery();
  const subjects = trpc.subject.list.useQuery();
  const classes = trpc.class.list.useQuery();
  const sectionLists = trpc.useQueries((t) =>
    (classes.data ?? []).map((item) => t.section.list({ classId: item.id })),
  );

  const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
  const sectionLabel = new Map(
    sectionLists.flatMap(
      (query) =>
        query.data?.map((section) => [
          section.id,
          `${className.get(section.classId) ?? ""} ${section.name}`.trim(),
        ]) ?? [],
    ),
  );

  return (
    <AcademicListScreen
      title="Teacher assignments"
      isLoading={assignments.isLoading}
      isError={assignments.isError}
      items={assignments.data}
      keyExtractor={(assignment) => assignment.id}
      emptyText="No teacher assignments yet."
      renderItem={(assignment) => (
        <ListRow>
          <Text className="font-sans text-body font-semibold text-neutral-900">
            {subjectName.get(assignment.subjectId) ?? assignment.subjectId}
          </Text>
          <Text className="font-sans text-sm text-neutral-500">
            {sectionLabel.get(assignment.sectionId) ?? assignment.sectionId}
          </Text>
          <Text className="font-sans text-sm text-neutral-500">
            Teacher: {assignment.teacherId === me.data?.userId ? "You" : assignment.teacherId}
          </Text>
        </ListRow>
      )}
    />
  );
}
