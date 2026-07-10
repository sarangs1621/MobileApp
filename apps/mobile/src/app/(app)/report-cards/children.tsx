import { Link } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { ScreenScaffold } from "../../../components/attendance-ui";
import { trpc } from "../../../lib/trpc";

/** Parent "Report cards": pick a child to view their PUBLISHED report cards (M7). */
export default function ChildrenReportCardsScreen() {
  const children = trpc.student.list.useQuery();
  const rows = children.data ?? [];

  return (
    <ScreenScaffold title="Report cards">
      {children.isLoading ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground">No children are linked to your account.</Text>
      ) : (
        rows.map((s) => (
          <Link
            key={s.id}
            href={{ pathname: "/report-cards/[studentId]", params: { studentId: s.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              className="gap-1 rounded-md border border-border bg-card p-4"
            >
              <Text className="font-medium text-foreground">
                {s.firstName} {s.lastName}
              </Text>
              <Text className="text-sm text-muted-foreground">Admission {s.admissionNo}</Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScreenScaffold>
  );
}
