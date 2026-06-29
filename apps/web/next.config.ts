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
};

export default config;
