import { LocaleProvider } from "@repo/i18n";
import { ThemeProvider } from "@repo/ui";
import { Stack } from "expo-router";

import "../../global.css";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LocaleProvider locale="en">
        <Stack screenOptions={{ headerShown: false }} />
      </LocaleProvider>
    </ThemeProvider>
  );
}
