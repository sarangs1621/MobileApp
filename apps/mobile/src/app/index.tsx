import { APP_TIMEZONE, DEFAULT_LOCALE } from "@repo/constants";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background p-6">
      <Text className="text-2xl font-semibold text-foreground">School Portal</Text>
      <Text className="text-muted-foreground">M0 foundation — mobile shell.</Text>
      <Text className="text-muted-foreground">
        Locale: {DEFAULT_LOCALE} · TZ: {APP_TIMEZONE}
      </Text>
    </View>
  );
}
