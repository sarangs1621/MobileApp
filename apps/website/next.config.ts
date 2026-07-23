import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

/**
 * Public marketing site for Sri Gujarati Vidyalaya. Standalone — no auth,
 * no database; school photography is hotlinked from the live WordPress site
 * with a graceful crest fallback (see src/components/site/Img.tsx).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
};

export default nextConfig;
