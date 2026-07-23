import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  useFonts,
} from "@expo-google-fonts/hanken-grotesk";
import { Newsreader_500Medium, Newsreader_600SemiBold } from "@expo-google-fonts/newsreader";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";

import { Splash } from "../components/splash";
import { ToastProvider } from "../components/ui";
import { Providers } from "../providers";
import { useAuthStore } from "../stores/auth-store";

import "../../global.css";

/**
 * Global error screen (ADR-025 §5). expo-router renders this for any uncaught
 * render error in the app, with a `retry` to recover. Exporting `ErrorBoundary`
 * from the root layout is the framework-native hook — no custom class component.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 justify-center gap-4 bg-background p-6">
      <Text className="text-2xl font-semibold text-foreground">Something went wrong</Text>
      <Text className="text-sm text-foreground opacity-70">{error.message}</Text>
      <Pressable
        onPress={retry}
        className="min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3"
      >
        <Text className="font-medium text-primary-foreground">Try again</Text>
      </Pressable>
    </View>
  );
}

/** Splash / gate: show a loader until the session is restored, then the navigator. */
function RootGate() {
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return <Splash />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  // Hanken Grotesk (UI sans) + Newsreader (serif display for headings) — the
  // heritage identity. Gate render until fonts load so text doesn't flash the
  // system font. Screens apply `font-sans` / `font-display`.
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
  });

  if (!fontsLoaded) {
    return <Splash />;
  }

  return (
    <Providers>
      <ToastProvider>
        {/* Dark status-bar glyphs — every screen sits on a light parchment/white header. */}
        <StatusBar style="dark" />
        <RootGate />
      </ToastProvider>
    </Providers>
  );
}
