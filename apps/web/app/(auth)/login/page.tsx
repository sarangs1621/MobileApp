"use client";

import { signInWithOtp, signInWithPassword, verifyOtp } from "@repo/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupabaseClient } from "@/src/lib/supabase/client";

type Mode = "staff" | "parent";

const inputClass = "rounded-md border border-input px-3 py-2 text-foreground";
const primaryBtn =
  "min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");

  async function run(action: () => Promise<void>, navigate: boolean): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await action();
      if (navigate) {
        // The browser client set the session cookie; refresh so the server sees it.
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (mode === "staff") {
      void run(() => signInWithPassword(supabase, { email: email.trim(), password }), true);
    } else if (!otpSent) {
      void run(async () => {
        await signInWithOtp(supabase, { phone: phone.trim() });
        setOtpSent(true);
      }, false);
    } else {
      void run(() => verifyOtp(supabase, { phone: phone.trim(), token: code.trim() }), true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-3xl font-semibold text-foreground">School Portal</h1>

      <div className="flex gap-2">
        <ModeTab label="Staff" active={mode === "staff"} onClick={() => setMode("staff")} />
        <ModeTab label="Parent" active={mode === "parent"} onClick={() => setMode("parent")} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "staff" ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <Link href="/forgot-password" className="text-sm text-primary">
              Forgot password?
            </Link>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Phone number
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                disabled={otpSent}
                required
              />
            </label>
            {otpSent ? (
              <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={inputClass}
                  required
                />
              </label>
            ) : null}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? "Please wait…" : otpSent ? "Verify code" : "Send code"}
            </button>
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </main>
  );
}

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex-1 rounded-md border px-4 py-2 font-medium ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
