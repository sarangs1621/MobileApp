import { useTranslation } from "@repo/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../stores/auth-store";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * Parent sign-in step 2 — 6-digit OTP entry. A single hidden input drives six
 * display boxes (native RN pattern); on verify the auth store flips to signedIn
 * and the (auth) layout redirects into the app. Resend is rate-limited by a timer.
 */
export default function VerifyOtpScreen() {
  const { dict } = useTranslation();
  const t = dict.auth;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const confirmOtp = useAuthStore((state) => state.confirmOtp);
  const requestOtp = useAuthStore((state) => state.requestOtp);

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || !phone) return;
    setError(null);
    setBusy(true);
    try {
      await confirmOtp(phone, value);
      // Success flips auth status → the (auth) layout Redirects into the app.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dict.common.somethingWentWrong);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (remaining > 0 || !phone) return;
    setError(null);
    try {
      await requestOtp(phone);
      setRemaining(RESEND_SECONDS);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dict.common.somethingWentWrong);
    }
  };

  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? "");
  const filledIndex = code.length; // the "active" (gold) box

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
        <Text className="font-display text-display text-neutral-900">{t.enterCode}</Text>
        <Text className="font-sans text-sm leading-relaxed text-neutral-500">
          {t.codeSentTo(phone ?? "")}{" "}
          <Text className="font-semibold text-primary-700" onPress={() => router.back()}>
            {t.change}
          </Text>
        </Text>
      </View>

      {/* Hidden input captures the code; the boxes below are a visual proxy. */}
      <Pressable className="mt-6" onPress={() => inputRef.current?.focus()}>
        <View className="flex-row justify-between">
          {boxes.map((digit, i) => {
            const active = i === filledIndex;
            return (
              <View
                key={i}
                className={`aspect-[0.82] flex-1 items-center justify-center rounded-xl border bg-white ${
                  i > 0 ? "ml-2" : ""
                } ${digit ? "border-primary-700" : active ? "border-gold-500" : "border-subtle"}`}
              >
                <Text className="font-sans text-xl font-bold text-neutral-900">{digit}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          className="absolute size-px opacity-0"
          value={code}
          onChangeText={(v) => {
            const next = v.replace(/\D/g, "").slice(0, CODE_LENGTH);
            setCode(next);
            if (next.length === CODE_LENGTH) void verify(next);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          autoFocus
        />
      </Pressable>

      {error ? <Text className="mt-3 font-sans text-caption text-danger-600">{error}</Text> : null}

      <View className="mt-6 gap-3">
        <Button
          label={t.verifyContinue}
          loading={busy}
          disabled={code.length !== CODE_LENGTH}
          onPress={() => verify(code)}
        />
        <Text className="text-center font-sans text-caption text-neutral-500">
          {t.didntGetIt}{" "}
          {remaining > 0 ? (
            <Text className="text-neutral-300">
              {t.resendIn(`0:${String(remaining).padStart(2, "0")}`)}
            </Text>
          ) : (
            <Text className="font-semibold text-primary-700" onPress={resend}>
              {t.resend}
            </Text>
          )}
        </Text>
      </View>
    </View>
  );
}
