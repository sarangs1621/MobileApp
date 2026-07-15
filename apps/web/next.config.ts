import path from "node:path";

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker (ADR-025 §7). In a monorepo, trace
  // from the repo root so workspace deps + the Prisma client are included.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
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
  // Baseline security headers (M1 Step 9) + CSP (M17/ADR-025 §2). Supabase SSR
  // auth cookies are JS-readable by design, so XSS/clickjacking are the
  // session-theft vectors: deny framing, lock MIME sniffing, force HTTPS.
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
          // CSP is ENFORCED with a per-request nonce — set in middleware.ts (it
          // needs a fresh nonce per request, which static headers can't provide).
        ],
      },
    ];
  },
};

export default config;
