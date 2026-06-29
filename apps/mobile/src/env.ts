import { APP_ENVS } from "@repo/constants";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Strongly-typed public env for the Expo app (only EXPO_PUBLIC_* is bundled).
 * Validation runs when imported at runtime; `SKIP_ENV_VALIDATION=true` lets CI
 * bundle without real values. Dev PRD §11.
 */
export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_APP_ENV: z.enum(APP_ENVS).default("development"),
    EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    EXPO_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
