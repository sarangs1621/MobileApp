import { Redirect, Stack } from "expo-router";
import { SignOut, WarningCircle } from "phosphor-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "../../components/ui";
import { useAttendanceSync } from "../../lib/attendance-sync";
import { usePushRegistration } from "../../lib/push";
import { trpc } from "../../lib/trpc";
import { useAuthStore } from "../../stores/auth-store";

/** Protected app group — requires a signed-in, activated account. */
export default function AppLayout() {
  const status = useAuthStore((state) => state.status);

  if (status === "signedOut") {
    return <Redirect href="/(auth)" />;
  }
  return <ActivationGate />;
}

/**
 * Resolves the DB profile (`auth.me`) and, on first sign-in, activates an INVITED
 * account (`auth.registerProfile`) before rendering the app shell. A signed-in
 * Supabase user with no profile is surfaced as "not set up".
 */
function ActivationGate() {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logout = useAuthStore((state) => state.logout);
  const register = trpc.auth.registerProfile.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
    },
  });

  useEffect(() => {
    if (me.data?.status === "INVITED" && register.isIdle) {
      register.mutate();
    }
  }, [me.data?.status, register]);

  if (me.isError) {
    // Signed-in Supabase user with no DB profile — surface it AND give a way out
    // (sign out → back to login), so a stale session can't trap the user here.
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-neutral-50 p-8">
        <View className="size-14 items-center justify-center rounded-2xl bg-danger-100">
          <WarningCircle size={28} color="#B23A28" weight="bold" />
        </View>
        <View className="gap-1.5">
          <Text className="text-center font-display text-title text-neutral-900">
            Account not set up
          </Text>
          <Text className="max-w-xs text-center font-sans text-sm text-neutral-500">
            Your account isn’t set up yet. Please contact the school office, or sign out to use a
            different account.
          </Text>
        </View>
        <Button variant="secondary" Icon={SignOut} label="Sign out" onPress={() => void logout()} />
      </View>
    );
  }

  if (me.isLoading || me.data?.status !== "ACTIVE" || register.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator color="#7A3414" />
      </View>
    );
  }

  return (
    <>
      <PushRegistrar />
      <AttendanceSyncRunner />
      {/* Create/apply actions present as slide-up sheets (design handoff: "create /
          pay / leave use bottom sheets"); everything else pushes normally. */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="homework/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="behaviour/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="attendance/leave" options={{ presentation: "modal" }} />
        <Stack.Screen name="announcements/new" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

/** Registers this device for push once the session is signed-in and ACTIVE. */
function PushRegistrar(): null {
  usePushRegistration();
  return null;
}

/** Drains the offline attendance queue on reconnect/foreground while signed in. */
function AttendanceSyncRunner(): null {
  useAttendanceSync();
  return null;
}
