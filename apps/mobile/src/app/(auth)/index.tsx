import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import { ArrowRight, ChalkboardTeacher, UsersThree } from "phosphor-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import crest from "../../../assets/crest.png";

/**
 * Portal chooser (design handoff) — the shared entry point. There is no
 * post-login role switch: parents authenticate by phone + OTP, staff by email.
 * Each card routes to the matching sign-in flow.
 */
export default function ChoosePortalScreen() {
  const { dict } = useTranslation();
  const t = dict.auth;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-neutral-50 px-7"
      style={{ paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 }}
    >
      <View className="gap-2.5 pt-5">
        <Image source={crest} className="size-14" resizeMode="contain" />
        <Text className="font-display text-display text-neutral-900">{t.welcome}</Text>
        <Text className="font-sans text-sm text-neutral-500">{t.howSignIn}</Text>
      </View>

      <View className="mt-6 gap-3.5">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/parent")}
          className="flex-row items-center gap-4 rounded-2xl bg-primary-900 px-4 py-5 active:opacity-90"
        >
          <View className="size-12 items-center justify-center rounded-2xl bg-neutral-50/15">
            <UsersThree size={25} color="#D6B36A" weight="bold" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-sans text-lg font-semibold text-neutral-50">{t.imParent}</Text>
            <Text className="font-sans text-caption text-neutral-50/70">
              {t.parentEntrySubtitle}
            </Text>
          </View>
          <ArrowRight size={20} color="#D6B36A" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(auth)/staff")}
          className="flex-row items-center gap-4 rounded-2xl border border-subtle bg-white px-4 py-5 active:bg-neutral-100"
        >
          <View className="size-12 items-center justify-center rounded-2xl bg-gold-100">
            <ChalkboardTeacher size={25} color="#8A661F" weight="bold" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-sans text-lg font-semibold text-neutral-900">
              {t.staffPortal}
            </Text>
            <Text className="font-sans text-caption text-neutral-500">{t.staffEntrySubtitle}</Text>
          </View>
          <ArrowRight size={20} color="#B8A88F" />
        </Pressable>
      </View>

      <Text className="mt-auto text-center font-sans text-caption text-neutral-400">
        {t.notRegistered}
      </Text>
    </View>
  );
}
