import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
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

// Remote push was removed from Expo Go in SDK 53 — importing expo-notifications
// there throws at startup on Android, so the module only loads in real builds.
const isExpoGo = Constants.executionEnvironment === "storeClient";

const Notifications: typeof ExpoNotifications | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-notifications") as typeof ExpoNotifications);

// Foreground display: without this, a push arriving while the app is open is silent.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const platform = (): "ios" | "android" => (Platform.OS === "ios" ? "ios" : "android");

async function getExpoPushToken(): Promise<
  | { token: string }
  | { token: null; status: "no-project-id" | "permission-denied" | "token-error" | "expo-go" }
> {
  if (!Notifications) {
    return { token: null, status: "expo-go" };
  }
  const existing = await Notifications.getPermissionsAsync();
  const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return { token: null, status: "permission-denied" };
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] no EAS projectId configured — skipping push registration");
    return { token: null, status: "no-project-id" };
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data };
  } catch (err) {
    console.warn("[push] failed to resolve Expo push token", err);
    return { token: null, status: "token-error" };
  }
}

/** Register this device once, on mount of a signed-in ACTIVE session. */
export function usePushRegistration(): void {
  const setPushToken = useAuthStore((s) => s.setPushToken);
  const setPushStatus = useAuthStore((s) => s.setPushStatus);
  const register = trpc.notification.registerDevice.useMutation();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getExpoPushToken();
      if (cancelled) {
        return;
      }
      if (result.token === null) {
        // Surfaced in Settings so the operator can tell push isn't live.
        setPushStatus(result.status);
        return;
      }
      setPushStatus("registered");
      setPushToken(result.token);
      register.mutate({ expoPushToken: result.token, platform: platform() });
    })();
    return () => {
      cancelled = true;
    };
    // Run once per mount (this component only renders for a signed-in ACTIVE session).
  }, []);
}
