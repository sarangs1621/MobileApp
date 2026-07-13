import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuthStore } from "../stores/auth-store";

import { trpc } from "./trpc";

/**
 * Push registration (Phase 1). Requests permission, resolves the Expo push token,
 * and registers it server-side (`notification.registerDevice`). The token is stored
 * in the auth store so logout can deregister it while still authenticated.
 *
 * ponytail: needs an EAS `projectId` (app.json → extra.eas.projectId) to mint a
 * token on a real device — absent today, so this no-ops gracefully. That project
 * config is an operator step (like the SMS provider), not code.
 */

// Foreground display: without this, a push arriving while the app is open is silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const platform = (): "ios" | "android" => (Platform.OS === "ios" ? "ios" : "android");

async function getExpoPushToken(): Promise<string | null> {
  const existing = await Notifications.getPermissionsAsync();
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] no EAS projectId configured — skipping push registration");
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn("[push] failed to resolve Expo push token", err);
    return null;
  }
}

/** Register this device once, on mount of a signed-in ACTIVE session. */
export function usePushRegistration(): void {
  const setPushToken = useAuthStore((s) => s.setPushToken);
  const register = trpc.notification.registerDevice.useMutation();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getExpoPushToken();
      if (!token || cancelled) {
        return;
      }
      setPushToken(token);
      register.mutate({ expoPushToken: token, platform: platform() });
    })();
    return () => {
      cancelled = true;
    };
    // Run once per mount (this component only renders for a signed-in ACTIVE session).
  }, []);
}
