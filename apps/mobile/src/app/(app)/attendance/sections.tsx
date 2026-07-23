import { useTranslation } from "@repo/i18n";
import { Link } from "expo-router";
import { Pressable, Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

/**
 * Teacher/admin entry to marking: the distinct sections the actor teaches (from
 * their TeacherAssignment rows — admins see all). Daily attendance is per
 * section, so subjects are collapsed. Tap a section → today's register.
 */
export default function AttendanceSectionsScreen() {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const assignments = trpc.teacherAssignment.list.useQuery({});
  const classes = trpc.class.list.useQuery();
  const classIds = [...new Set((classes.data ?? []).map((c) => c.id))];
  const sectionLists = trpc.useQueries((t) =>
    classIds.map((classId) => t.section.list({ classId })),
  );

  const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]));
  const sectionInfo = new Map(
    sectionLists.flatMap(
      (q) => q.data?.map((s) => [s.id, { name: s.name, classId: s.classId }] as const) ?? [],
    ),
  );

  const sectionIds = [...new Set((assignments.data ?? []).map((a) => a.sectionId))];

  return (
    <AcademicListScreen
      title={t.markAttendance}
      isLoading={assignments.isLoading}
      isError={assignments.isError}
      items={sectionIds}
      keyExtractor={(id) => id}
      emptyText={t.notAssignedSections}
      renderItem={(sectionId) => {
        const info = sectionInfo.get(sectionId);
        const label = info
          ? t.sectionLabel(className.get(info.classId) ?? info.classId, info.name)
          : sectionId;
        return (
          <Link href={{ pathname: "/attendance/mark/[sectionId]", params: { sectionId } }} asChild>
            <Pressable accessibilityRole="button">
              <ListRow>
                <Text className="font-sans text-body font-semibold text-neutral-900">{label}</Text>
                <Text className="font-sans text-sm text-neutral-500">{t.todaysDailyRegister}</Text>
              </ListRow>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
