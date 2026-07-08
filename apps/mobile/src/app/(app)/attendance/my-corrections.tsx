import type { CorrectionStatusKey } from "@repo/types";
import { Text } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { trpc } from "../../../lib/trpc";

const STATUS_CLASS: Record<CorrectionStatusKey, string> = {
  PENDING: "text-info",
  APPROVED: "text-success",
  REJECTED: "text-destructive",
};

/**
 * A teacher's own submitted attendance corrections + their decision status
 * (read-only — approving is an admin action, done on the web). ADR-011 §8.
 */
export default function MyCorrectionsScreen() {
  const corrections = trpc.attendanceCorrection.listMine.useQuery();

  return (
    <AcademicListScreen
      title="My corrections"
      isLoading={corrections.isLoading}
      isError={corrections.isError}
      items={corrections.data}
      keyExtractor={(c) => c.id}
      emptyText="You haven’t requested any corrections."
      renderItem={(c) => (
        <ListRow>
          <Text className="font-medium text-foreground">
            {c.previousStatus} → {c.requestedStatus}
          </Text>
          <Text className="text-sm text-muted-foreground">{c.reason}</Text>
          <Text className={`text-sm font-medium ${STATUS_CLASS[c.status]}`}>{c.status}</Text>
        </ListRow>
      )}
    />
  );
}
