import {
  createBrowserClient as createSsrBrowserClient,
  createServerClient as createSsrServerClient,
} from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Cookie adapter shape required by the SSR server client (provided by the host app). */
type ServerCookies = NonNullable<Parameters<typeof createSsrServerClient>[2]>["cookies"];

/** Browser (Next client components). */
export function createBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createSsrBrowserClient(url, anonKey);
}

/** Server (Next route handlers / server components); cookie store injected by the app. */
export function createServerClient(
  url: string,
  anonKey: string,
  cookies: ServerCookies,
): SupabaseClient {
  return createSsrServerClient(url, anonKey, { cookies });
}

/** Async storage shape the Expo app injects (e.g. AsyncStorage / SecureStore). */
export interface SupabaseStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Expo (React Native): supabase-js with the app's persistent storage. */
export function createExpoClient(
  url: string,
  anonKey: string,
  storage: SupabaseStorage,
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
