import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useAuthStore } from "../../stores/auth-store";

type Mode = "staff" | "parent";

export default function LoginScreen() {
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
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 justify-center gap-5 bg-background p-6">
      <Text className="text-3xl font-semibold text-foreground">School Portal</Text>

      <View className="flex-row gap-2">
        <ModeTab label="Staff" active={mode === "staff"} onPress={() => setMode("staff")} />
        <ModeTab label="Parent" active={mode === "parent"} onPress={() => setMode("parent")} />
      </View>

      {mode === "staff" ? (
        <View className="gap-3">
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
          <SubmitButton
            label="Sign in"
            busy={busy}
            onPress={() => run(() => signInWithEmail(email.trim(), password))}
          />
        </View>
      ) : (
        <View className="gap-3">
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            editable={!otpSent}
          />
          {otpSent ? (
            <>
              <Field
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
              />
              <SubmitButton
                label="Verify code"
                busy={busy}
                onPress={() => run(() => confirmOtp(phone.trim(), code.trim()))}
              />
            </>
          ) : (
            <SubmitButton
              label="Send code"
              busy={busy}
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

      {error ? <Text className="text-destructive">{error}</Text> : null}
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 rounded-md border px-4 py-3 ${active ? "border-primary bg-primary" : "border-border"}`}
    >
      <Text className={`text-center font-medium ${active ? "text-primary-foreground" : "text-foreground"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  textContentType?: "emailAddress" | "password" | "telephoneNumber" | "oneTimeCode";
}

function Field({ label, ...input }: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className="rounded-md border border-input px-3 py-3 text-foreground"
        {...input}
      />
    </View>
  );
}

function SubmitButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      className={`min-h-11 items-center justify-center rounded-md bg-primary px-4 py-3 ${busy ? "opacity-60" : ""}`}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="font-medium text-primary-foreground">{label}</Text>
      )}
    </Pressable>
  );
}
