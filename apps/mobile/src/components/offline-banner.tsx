import { useTranslation } from "@repo/i18n";
import { Text, View } from "react-native";

import { useIsOnline } from "../lib/use-online";

/**
 * Offline Layer 1 (§Layer-1.8). Shown on screens that need freshness; nothing when
 * online. Reads the global `onlineManager` state (NetInfo-fed).
 */
export function OfflineBanner({ message }: { message?: string }): React.JSX.Element | null {
  const { dict } = useTranslation();
  const online = useIsOnline();
  if (online) {
    return null;
  }
  return (
    <View className="rounded-xl border border-subtle bg-neutral-100 px-3 py-2.5">
      <Text className="font-sans text-sm font-semibold text-neutral-700">
        {message ?? dict.sync.offline}
      </Text>
    </View>
  );
}
