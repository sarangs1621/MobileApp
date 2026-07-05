import type { AcademicYearStatusKey } from "@repo/types";
import { Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

const STATUS_CLASS: Record<AcademicYearStatusKey, string> = {
  ACTIVE: "text-success",
  PLANNED: "text-info",
  CLOSED: "text-muted-foreground",
};

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
          <Text className="font-medium text-foreground">{year.name}</Text>
          <Text className="text-sm text-muted-foreground">
            {year.startDate} → {year.endDate}
          </Text>
          <Text className={`text-sm font-medium ${STATUS_CLASS[year.status]}`}>{year.status}</Text>
        </ListRow>
      )}
    />
  );
}
