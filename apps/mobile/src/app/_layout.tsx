import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { Providers } from "../providers";
import { useAuthStore } from "../stores/auth-store";

import "../../global.css";

/** Splash / gate: show a loader until the session is restored, then the navigator. */
function RootGate() {
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <Providers>
      <RootGate />
    </Providers>
  );
}
