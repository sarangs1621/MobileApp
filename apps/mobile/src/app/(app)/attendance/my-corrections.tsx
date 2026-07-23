import { useTranslation } from "@repo/i18n";
import type { CorrectionStatusKey } from "@repo/types";
import { Text, View } from "react-native";

import { AcademicListScreen, ListRow } from "../../../components/academic-list";
import { StatusChip, titleCase, type Tone } from "../../../components/ui";
import { trpc } from "../../../lib/trpc";

const STATUS_TONE: Record<CorrectionStatusKey, Tone> = {
  PENDING: "info",
  APPROVED: "success",
  REJECTED: "danger",
};

/**
 * A teacher's own submitted attendance corrections + their decision status
 * (read-only — approving is an admin action, done on the web). ADR-011 §8.
 */
export default function MyCorrectionsScreen() {
  const { dict } = useTranslation();
  const t = dict.attendance;
  const corrections = trpc.attendanceCorrection.listMine.useQuery();

  return (
    <AcademicListScreen
      title={t.myCorrections}
      isLoading={corrections.isLoading}
      isError={corrections.isError}
      items={corrections.data}
      keyExtractor={(c) => c.id}
      emptyText={t.noCorrections}
      renderItem={(c) => (
        <ListRow>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-sans text-body font-semibold text-neutral-900">
              {c.previousStatus} → {c.requestedStatus}
            </Text>
            <StatusChip tone={STATUS_TONE[c.status]} label={titleCase(c.status)} dot />
          </View>
          <Text className="font-sans text-sm text-neutral-500">{c.reason}</Text>
        </ListRow>
      )}
    />
  );
}
