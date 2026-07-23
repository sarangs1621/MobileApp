import { useTranslation } from "@repo/i18n";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useOfflineQueueStore } from "../stores/offline-queue-store";

/**
 * Offline Layer 2 UI contract (§Layer-2). A badge with the pending/failed count on
 * the teacher Home + attendance screens; tap to see each queued register with its
 * failure reason and per-entry Retry / Discard. Retry works on PENDING too (so a
 * transient failure while online is manually re-drainable), never silently dropped.
 */
export function SyncQueueIndicator(): React.JSX.Element | null {
  const { dict } = useTranslation();
  const t = dict.sync;
  const queue = useOfflineQueueStore((s) => s.queue);
  const retry = useOfflineQueueStore((s) => s.retry);
  const discard = useOfflineQueueStore((s) => s.discard);
  const [open, setOpen] = useState(false);

  if (queue.length === 0) {
    return null;
  }

  const failed = queue.filter((e) => e.state === "FAILED").length;
  const pending = queue.length - failed;
  const tone = failed > 0 ? "text-danger-600" : "text-info-600";

  return (
    <View className="overflow-hidden rounded-card border border-subtle bg-card shadow-sm">
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((v) => !v)}
        className="min-h-11 flex-row items-center justify-between px-3 py-2.5"
      >
        <Text className={`font-sans text-sm font-semibold ${tone}`}>
          {failed > 0 ? t.needReview(failed) : t.waiting(pending)}
        </Text>
        <Text className="font-sans text-sm font-semibold text-primary-700">
          {open ? t.hide : t.view}
        </Text>
      </Pressable>

      {open
        ? queue.map((entry) => (
            <View key={entry.id} className="border-t border-subtle px-3 py-2.5">
              <Text className="font-sans text-sm font-semibold text-neutral-900">
                {entry.dateIST} · {t.studentCount(entry.marks.length)} · {entry.state}
              </Text>
              {entry.reason ? (
                <Text className="mt-1 font-sans text-caption text-danger-600">{entry.reason}</Text>
              ) : null}
              {entry.state !== "SYNCING" ? (
                <View className="mt-2 flex-row gap-4">
                  <Pressable accessibilityRole="button" onPress={() => retry(entry.id)}>
                    <Text className="font-sans text-sm font-semibold text-primary-700">
                      {dict.common.retry}
                    </Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => discard(entry.id)}>
                    <Text className="font-sans text-sm font-semibold text-danger-600">
                      {t.discard}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
}
