"use client";

import { signInWithOtp, signInWithPassword, verifyOtp } from "@repo/auth";
import { cn } from "@repo/ui";
import {
  Briefcase,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  School,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input } from "@/src/components/ui";
import { getSupabaseClient } from "@/src/lib/supabase/client";

type Mode = "staff" | "parent";

const MODES = [
  { key: "staff", label: "Staff", icon: Briefcase },
  { key: "parent", label: "Parent", icon: Users },
] as const;

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: "Attendance, homework and the day's classwork" },
  { icon: GraduationCap, text: "Exams, grades and report cards" },
  { icon: MessageSquare, text: "Fees, announcements and parent messaging" },
] as const;

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
    <main className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-900 p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 size-[30rem] rounded-full bg-navy-600/30 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <School aria-hidden strokeWidth={1.75} className="size-6 text-white" />
          </span>
          <div>
            <p className="font-semibold text-white">Sri Gujarathi Vidhyalaya</p>
            <p className="text-sm text-navy-300">School Portal</p>
          </div>
        </div>

        <div className="relative flex max-w-md flex-col gap-10">
          <p className="text-balance text-3xl font-semibold leading-snug text-white">
            The whole school day, in one place.
          </p>
          <ul className="flex flex-col gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                  <Icon aria-hidden strokeWidth={1.75} className="size-5 text-navy-200" />
                </span>
                <span className="text-navy-100">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-navy-300">
          © {new Date().getFullYear()} Sri Gujarathi Vidhyalaya
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center lg:hidden">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-navy-800">
              <School aria-hidden strokeWidth={1.75} className="size-7 text-white" />
            </span>
            <p className="text-title text-neutral-900">Sri Gujarathi Vidhyalaya</p>
          </div>

          <div className="flex flex-col gap-1 text-center lg:text-left">
            <h1 className="text-display text-neutral-900">Welcome back</h1>
            <p className="text-neutral-500">Sign in to the school portal</p>
          </div>

          <div
            className="flex rounded-lg bg-neutral-100 p-1"
            role="group"
            aria-label="Account type"
          >
            {MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key);
                  setError(null);
                }}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-md font-medium transition-colors duration-fast",
                  mode === key
                    ? "bg-white text-navy-800 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700",
                )}
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {mode === "staff" ? (
              <>
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Link
                  href="/forgot-password"
                  className="-mt-2 self-end text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  Forgot password?
                </Link>
                <Button type="submit" size="lg" loading={busy}>
                  Sign in
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
                  helper="Use the mobile number registered with the school."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={otpSent}
                  required
                />
                {otpSent ? (
                  <>
                    <Input
                      label="Verification code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      helper="We sent a 6-digit code to your phone."
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setCode("");
                        setError(null);
                      }}
                      className="-mt-2 self-end text-sm font-medium text-primary-700 hover:text-primary-800"
                    >
                      Change number
                    </button>
                  </>
                ) : null}
                <Button type="submit" size="lg" loading={busy}>
                  {otpSent ? "Verify code" : "Send code"}
                </Button>
              </>
            )}

            {error ? (
              <div
                role="alert"
                className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700"
              >
                {error}
              </div>
            ) : null}
          </form>

          <p className="text-center text-sm text-neutral-500">
            Accounts are created by the school office — contact the office if you can&apos;t sign
            in.
          </p>
        </div>
      </div>
    </main>
  );
}
