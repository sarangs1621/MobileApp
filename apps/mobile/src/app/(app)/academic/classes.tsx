import { Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

/** Read-only classes list (M2 placeholder — manage on web). */
export default function ClassesScreen() {
  const classes = trpc.class.list.useQuery();

  return (
    <AcademicListScreen
      title="Classes"
      isLoading={classes.isLoading}
      isError={classes.isError}
      items={classes.data}
      keyExtractor={(item) => item.id}
      emptyText="No classes yet."
      renderItem={(item) => (
        <ListRow>
          <Text className="font-medium text-foreground">{item.name}</Text>
        </ListRow>
      )}
    />
  );
}
