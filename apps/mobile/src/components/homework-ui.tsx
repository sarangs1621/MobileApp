import { useTranslation } from "@repo/i18n";
import type { HomeworkStatusKey, SubmissionStatusKey } from "@repo/types";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

export const HW_STATUS_LABEL: Record<HomeworkStatusKey, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
};

export const SUB_STATUS_LABEL: Record<SubmissionStatusKey, string> = {
  SUBMITTED: "Submitted",
  RETURNED: "Changes requested",
  REVIEWED: "Reviewed",
};

export const SUB_STATUS_CLASS: Record<SubmissionStatusKey, string> = {
  SUBMITTED: "text-info",
  RETURNED: "text-destructive",
  REVIEWED: "text-success",
};

type Attachment = { id: string; fileName: string };

/**
 * Attachment list with tap-to-open (M6, mobile). Tapping mints a short-lived signed
 * URL via `onMint` and opens it in the browser — mobile has no file picker, so
 * uploads happen on web; download/view works everywhere (ponytail: expo-linking, no
 * new dep). Shows an empty hint when there are no files.
 */
export function AttachmentList({
  attachments,
  onMint,
  emptyHint,
}: {
  attachments: Attachment[];
  onMint: (attachmentId: string) => Promise<{ url: string }>;
  emptyHint?: string;
}) {
  const { dict } = useTranslation();
  if (attachments.length === 0) {
    return emptyHint ? <Text className="text-sm text-muted-foreground">{emptyHint}</Text> : null;
  }
  return (
    <View className="gap-2">
      {attachments.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => {
            void onMint(a.id).then(({ url }) => Linking.openURL(url));
          }}
          className="min-h-11 flex-row items-center justify-between rounded-md border border-border bg-card px-3 py-2"
        >
          <Text className="flex-1 text-foreground" numberOfLines={1}>
            📎 {a.fileName}
          </Text>
          <Text className="text-sm text-primary">{dict.homework.open}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Small inline loading/label helper for a section header. */
export function SectionLabel({ children }: { children: string }) {
  return <Text className="text-sm font-medium text-muted-foreground">{children}</Text>;
}

export function Loading() {
  return <ActivityIndicator />;
}
