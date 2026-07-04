"use client";

import { updatePassword } from "@repo/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "@/src/lib/supabase/client";

/**
 * Set a new password. Reached from the reset email link, which establishes a
 * short-lived recovery session; `updatePassword` then sets the new password.
 * Kept outside the (auth) group so the recovery session isn't bounced away.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize the client on mount (browser only) so it processes the recovery
  // token in the URL and establishes the short-lived recovery session.
  useEffect(() => {
    getSupabaseClient();
  }, []);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      await updatePassword(supabase, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-input px-3 py-2 text-foreground"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </main>
  );
}
