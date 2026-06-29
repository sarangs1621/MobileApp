import { DEFAULT_LOCALE } from "@repo/constants";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold text-foreground">School Portal</h1>
      <p className="text-muted-foreground">
        M0 foundation is running. This is infrastructure only — no application features yet.
      </p>
      <p className="text-sm text-muted-foreground">
        Default locale: <span className="font-medium text-foreground">{DEFAULT_LOCALE}</span> ·
        Health: <code className="rounded bg-muted px-1.5 py-0.5">/api/health</code>
      </p>
    </main>
  );
}
