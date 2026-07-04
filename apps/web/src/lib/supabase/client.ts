"use client";

import { createBrowserClient } from "@repo/auth";

import { env } from "@/src/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Lazily create (and memoize) the browser Supabase client. Called only from
 * event handlers — never at module load or during render — so it is never
 * instantiated during server prerendering (where NEXT_PUBLIC_* config is absent).
 */
export function getSupabaseClient() {
  client ??= createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
