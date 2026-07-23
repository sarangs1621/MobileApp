import { Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

/** Read-only subjects list (M2 placeholder — manage on web). */
export default function SubjectsScreen() {
  const subjects = trpc.subject.list.useQuery();

  return (
    <AcademicListScreen
      title="Subjects"
      isLoading={subjects.isLoading}
      isError={subjects.isError}
      items={subjects.data}
      keyExtractor={(subject) => subject.id}
      emptyText="No subjects yet."
      renderItem={(subject) => (
        <ListRow>
          <Text className="font-sans text-body font-semibold text-neutral-900">{subject.name}</Text>
        </ListRow>
      )}
    />
  );
}
