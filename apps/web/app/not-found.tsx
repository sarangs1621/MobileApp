import Link from "next/link";

/** 404 boundary (App Router). Shown for unmatched routes. ADR-025 §5. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-3xl font-semibold text-foreground">Page not found</h1>
      <p className="text-sm text-foreground opacity-70">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Link
        href="/dashboard"
        className="min-h-11 rounded-md bg-primary px-4 py-2 text-center font-medium text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
