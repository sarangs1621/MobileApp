import { Feather } from "@expo/vector-icons";
import { useTranslation } from "@repo/i18n";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/fields";
import { SegmentedControl } from "../../components/ui/scaffold";
import { useAuthStore } from "../../stores/auth-store";

type Mode = "staff" | "parent";

export default function LoginScreen() {
  const { dict } = useTranslation();
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const confirmOtp = useAuthStore((state) => state.confirmOtp);

  const [mode, setMode] = useState<Mode>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");

  // On success, the auth store flips to "signedIn" and the (auth) layout redirects.
  const run = async (action: () => Promise<void>): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : dict.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 justify-center gap-5 bg-neutral-50 p-6">
      <View className="items-center gap-2">
        <View className="size-14 items-center justify-center rounded-2xl bg-navy-700">
          <Feather name="home" size={28} color="#FFFFFF" />
        </View>
        <Text className="text-display font-semibold text-neutral-900">
          Sri Gujarathi Vidhyalaya
        </Text>
        <Text className="text-sm text-neutral-500">{dict.auth.subtitle}</Text>
      </View>

      <Card className="gap-4">
        <SegmentedControl
          options={[
            { key: "staff", label: dict.auth.staff },
            { key: "parent", label: dict.auth.parent },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === "staff" ? (
          <View className="gap-4">
            <TextField
              label={dict.auth.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label={dict.auth.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
            <Button
              label={dict.auth.signIn}
              loading={busy}
              onPress={() => run(() => signInWithEmail(email.trim(), password))}
            />
          </View>
        ) : (
          <View className="gap-4">
            <TextField
              label={dict.auth.phone}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              editable={!otpSent}
            />
            {otpSent ? (
              <>
                <TextField
                  label={dict.auth.verificationCode}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                />
                <Button
                  label={dict.auth.verifyCode}
                  loading={busy}
                  onPress={() => run(() => confirmOtp(phone.trim(), code.trim()))}
                />
              </>
            ) : (
              <Button
                label={dict.auth.sendCode}
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await requestOtp(phone.trim());
                    setOtpSent(true);
                  })
                }
              />
            )}
          </View>
        )}

        {error ? <Text className="text-sm text-danger-600">{error}</Text> : null}
      </Card>
    </View>
  );
}
