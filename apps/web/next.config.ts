import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source and are transpiled by Next.
  transpilePackages: [
    "@repo/api",
    "@repo/auth",
    "@repo/constants",
    "@repo/i18n",
    "@repo/types",
    "@repo/ui",
    "@repo/utils",
    "@repo/validation",
  ],
  // Prisma must not be bundled by webpack; load it as a server external at runtime.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Linting runs via the monorepo pipeline (turbo run lint), not during build.
  eslint: { ignoreDuringBuilds: true },
  // Baseline security headers (M1 Step 9). Supabase SSR auth cookies are
  // JS-readable by design, so XSS/clickjacking are the session-theft vectors:
  // deny framing, lock MIME sniffing, force HTTPS. CSP is deferred until the
  // app shell stabilizes (needs nonce wiring for Next inline scripts).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
