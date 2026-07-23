import { Text, View } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { Avatar } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/**
 * Read-only teacher (staff) profiles list (M3 — manage on web). Row scope is
 * applied by the service: admins see all profiles; a teacher sees only their
 * own. Names live on the User record; rows are labelled by employee id.
 */
export default function TeacherProfilesScreen() {
  const me = trpc.auth.me.useQuery();
  const profiles = trpc.teacherProfile.list.useQuery();

  return (
    <AcademicListScreen
      title="Teacher profiles"
      isLoading={profiles.isLoading}
      isError={profiles.isError}
      items={profiles.data}
      keyExtractor={(profile) => profile.id}
      emptyText="No teacher profiles yet."
      renderItem={(profile) => (
        <ListRow>
          <View className="flex-row items-center gap-3">
            <Avatar name={profile.name} />
            <View className="flex-1 gap-0.5">
              <Text className="font-sans text-body font-semibold text-neutral-900">
                {profile.name}
                {profile.userId === me.data?.userId ? " · You" : ""}
              </Text>
              <Text className="font-sans text-sm text-neutral-500">
                {profile.employeeId} · {profile.department ?? "No department"} ·{" "}
                {profile.qualification ?? "—"}
              </Text>
              <Text className="font-sans text-caption text-neutral-400">
                Joined {profile.joiningDate ?? "—"} ·{" "}
                {profile.experienceYears != null
                  ? `${profile.experienceYears} yrs experience`
                  : "—"}
              </Text>
            </View>
          </View>
        </ListRow>
      )}
    />
  );
}
