import { APP_ENVS } from "@repo/constants";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Strongly-typed, fail-fast environment (Dev PRD §11). Validation runs when this
 * module is imported at runtime; `SKIP_ENV_VALIDATION=true` lets CI build/lint
 * without real secrets. `APP_ENV` selects development/staging/production.
 */
export const env = createEnv({
  server: {
    APP_ENV: z.enum(APP_ENVS).default("development"),
    DATABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
