"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Global error boundary (App Router). Only fires when the ROOT layout itself
 * throws — providers (theme/tRPC/locale) are gone, so this renders its own
 * <html>/<body> and stays self-contained. ADR-025 §5.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ponytail: wire a client error reporter (Sentry) here when one is added.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
          <h1 className="text-3xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-foreground opacity-70">
            The application ran into an unexpected error. Please reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
