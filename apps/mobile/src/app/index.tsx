import { Redirect } from "expo-router";

import { useAuthStore } from "../stores/auth-store";

/** Entry redirect: send the user to the app or the auth flow based on session. */
export default function Index() {
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return null; // the root gate already shows the splash loader
  }
  return <Redirect href={status === "signedIn" ? "/(app)" : "/(auth)/login"} />;
}
