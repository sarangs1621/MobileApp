import { Text, View } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { StatusChip } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

/** Read-only academic-years list (M2 placeholder — manage on web). */
export default function AcademicYearsScreen() {
  const years = trpc.academicYear.list.useQuery();

  return (
    <AcademicListScreen
      title="Academic years"
      isLoading={years.isLoading}
      isError={years.isError}
      items={years.data}
      keyExtractor={(year) => year.id}
      emptyText="No academic years yet."
      renderItem={(year) => (
        <ListRow>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
              {year.name}
            </Text>
            <StatusChip status={year.status} dot />
          </View>
          <Text className="font-sans text-sm text-neutral-500">
            {year.startDate} → {year.endDate}
          </Text>
        </ListRow>
      )}
    />
  );
}
