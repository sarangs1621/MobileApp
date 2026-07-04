import { createExpoClient, type SupabaseStorage } from "@repo/auth";
import * as SecureStore from "expo-secure-store";

import { env } from "../env";

/**
 * Secure token persistence: Supabase session is stored in the device Keychain/
 * Keystore via expo-secure-store (never AsyncStorage). The client auto-refreshes
 * the access token; the tRPC client attaches it per request (see ./trpc).
 */
const secureStorage: SupabaseStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createExpoClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  secureStorage,
);
