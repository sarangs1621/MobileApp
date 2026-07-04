"use client";

import { resetPassword } from "@repo/auth";
import Link from "next/link";
import { useState } from "react";

import { getSupabaseClient } from "@/src/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/update-password` : undefined;
      await resetPassword(supabase, email.trim(), redirectTo);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>

      {sent ? (
        <p className="text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-input px-3 py-2 text-foreground"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      )}

      <Link href="/login" className="text-sm text-primary">
        Back to sign in
      </Link>
    </main>
  );
}
