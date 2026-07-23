import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import { ArrowLeft, UsersThree } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../stores/auth-store";

/** Parent sign-in step 1 — collect the registered phone number and request an OTP. */
export default function ParentPhoneScreen() {
  const { dict } = useTranslation();
  const t = dict.auth;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requestOtp = useAuthStore((state) => state.requestOtp);

  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registered Indian numbers are 10 digits; Supabase expects E.164 (+91…).
  const e164 = `+91${digits}`;
  const valid = digits.length === 10;

  const send = async () => {
    if (!valid) {
      setError(t.invalidPhone);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestOtp(e164);
      router.push({ pathname: "/(auth)/verify", params: { phone: e164 } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className="flex-1 bg-neutral-50 px-7"
      style={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 20 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        className="size-11 items-center justify-center rounded-xl active:bg-primary-50"
      >
        <ArrowLeft size={22} color="#7A3414" weight="bold" />
      </Pressable>

      <View className="mt-2 gap-2.5">
        <View className="size-[52px] items-center justify-center rounded-2xl bg-primary-50">
          <UsersThree size={26} color="#7A3414" weight="bold" />
        </View>
        <Text className="font-display text-display text-neutral-900">{t.parentSignInTitle}</Text>
        <Text className="font-sans text-sm text-neutral-500">{t.parentPhoneHint}</Text>
      </View>

      <View className="mt-6 gap-2">
        <Text className="font-sans text-caption font-semibold text-neutral-700">{t.phone}</Text>
        <View
          className={`flex-row items-center gap-2.5 rounded-2xl border bg-white px-4 py-3.5 ${
            error ? "border-danger-500" : "border-primary-700"
          }`}
        >
          <Text className="border-r border-subtle pr-2.5 font-sans text-base font-semibold text-neutral-700">
            +91
          </Text>
          <TextInput
            className="flex-1 font-sans text-base tracking-wider text-neutral-900"
            value={digits}
            onChangeText={(v) => setDigits(v.replace(/\D/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="98470 12345"
            placeholderTextColor="#948676"
            maxLength={10}
            autoFocus
          />
        </View>
        {error ? <Text className="font-sans text-caption text-danger-600">{error}</Text> : null}
      </View>

      <View className="mt-6 gap-3">
        <Button label={t.sendOtp} loading={busy} disabled={!valid} onPress={send} />
        <Text className="text-center font-sans text-caption leading-relaxed text-neutral-400">
          {t.smsConsent}
        </Text>
      </View>
    </View>
  );
}
