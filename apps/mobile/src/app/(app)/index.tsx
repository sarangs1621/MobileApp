import { Pressable, Text, View } from "react-native";

import { trpc } from "../../lib/trpc";
import { useAuthStore } from "../../stores/auth-store";

/**
 * Role-aware placeholder home. Feature screens (attendance, marks, …) arrive in
 * later milestones; M1 only proves the authenticated, role-aware shell + logout.
 */
export default function AppHome() {
  const me = trpc.auth.me.useQuery();
  const logout = useAuthStore((state) => state.logout);
  const role = me.data?.role;

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Text className="text-2xl font-semibold text-foreground">School Portal</Text>
      <Text className="text-center text-muted-foreground">
        Signed in{role ? ` as ${role}` : ""}. Your dashboard appears here once
        features are enabled.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void logout();
        }}
        className="min-h-11 items-center justify-center rounded-md border border-border px-4 py-3"
      >
        <Text className="font-medium text-foreground">Log out</Text>
      </Pressable>
    </View>
  );
}
