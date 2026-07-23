import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "../../stores/auth-store";

/** Auth flow — if already signed in, bounce to the app. */
export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);

  if (status === "signedIn") {
    return <Redirect href="/(app)/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
