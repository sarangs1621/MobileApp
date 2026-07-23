import { resetPassword } from "@repo/auth";
import { useTranslation } from "@repo/i18n";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChalkboardTeacher,
  Envelope,
  Eye,
  EyeSlash,
  LockSimple,
} from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";

/**
 * Staff sign-in (design handoff) — email + password for teachers and office
 * staff. "Forgot password?" sends a Supabase recovery email. Biometric (Face ID
 * / fingerprint) is a follow-up: it needs `expo-local-authentication` + a native
 * rebuild, so it is intentionally not shown yet.
 */
export default function StaffSignInScreen() {
  const { dict } = useTranslation();
  const t = dict.auth;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      // Success flips auth status → the (auth) layout Redirects into the app.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const target = email.trim();
    if (!target) {
      setError(t.email);
      return;
    }
    setError(null);
    try {
      await resetPassword(supabase, target);
    } catch {
      // Don't reveal whether the email exists — always show the same notice.
    }
    setNotice(t.resetSent);
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
        <View className="size-[52px] items-center justify-center rounded-2xl bg-gold-100">
          <ChalkboardTeacher size={26} color="#8A661F" weight="bold" />
        </View>
        <Text className="font-display text-display text-neutral-900">{t.staffPortal}</Text>
        <Text className="font-sans text-sm text-neutral-500">{t.staffPortalSubtitle}</Text>
      </View>

      <View className="mt-6 gap-3.5">
        <View className="gap-1.5">
          <Text className="font-sans text-caption font-semibold text-neutral-700">
            {t.staffEmail}
          </Text>
          <View className="flex-row items-center gap-2.5 rounded-2xl border border-subtle bg-white px-4 py-3.5">
            <Envelope size={18} color="#948676" />
            <TextInput
              className="flex-1 font-sans text-base text-neutral-900"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@sgv.edu.in"
              placeholderTextColor="#948676"
            />
          </View>
        </View>

        <View className="gap-1.5">
          <Text className="font-sans text-caption font-semibold text-neutral-700">
            {t.password}
          </Text>
          <View className="flex-row items-center gap-2.5 rounded-2xl border border-subtle bg-white px-4 py-3.5">
            <LockSimple size={18} color="#948676" />
            <TextInput
              className="flex-1 font-sans text-base text-neutral-900"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor="#948676"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={show ? "Hide password" : "Show password"}
              onPress={() => setShow((v) => !v)}
              hitSlop={8}
            >
              {show ? <EyeSlash size={18} color="#948676" /> : <Eye size={18} color="#948676" />}
            </Pressable>
          </View>
        </View>

        <Text
          className="self-end font-sans text-caption font-semibold text-primary-700"
          onPress={forgot}
        >
          {t.forgotPassword}
        </Text>
      </View>

      {error ? <Text className="mt-3 font-sans text-caption text-danger-600">{error}</Text> : null}
      {notice ? (
        <Text className="mt-3 font-sans text-caption text-success-600">{notice}</Text>
      ) : null}

      <View className="mt-5">
        <Button label={t.signIn} loading={busy} onPress={signIn} />
      </View>

      <Text className="mt-auto text-center font-sans text-caption text-neutral-400">
        {t.accountsByAdmin}
      </Text>
    </View>
  );
}
