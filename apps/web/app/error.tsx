"use client";

import { useEffect } from "react";

/**
 * Route-segment error boundary (App Router). Catches render/data errors under
 * the root layout and offers a recovery `reset()` — the app shell (nav/theme)
 * stays mounted. Catastrophic root-layout failures fall through to
 * `global-error.tsx`. ADR-025 §5.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next already logs server-side; this surfaces it in the browser console.
    // ponytail: wire a client error reporter (Sentry) here when one is added.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-3xl font-semibold text-foreground">Something went wrong</h1>
      <p className="text-sm text-foreground opacity-70">
        An unexpected error occurred. Please try again — if it keeps happening, contact your
        administrator.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
