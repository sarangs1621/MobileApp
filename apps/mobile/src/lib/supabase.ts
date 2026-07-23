import { createExpoClient, type SupabaseStorage } from "@repo/auth";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { env } from "../env";

/**
 * Secure token persistence: Supabase session is stored in the device Keychain/
 * Keystore via expo-secure-store (never AsyncStorage). The client auto-refreshes
 * the access token; the tRPC client attaches it per request (see ./trpc).
 */
const secureStorage: SupabaseStorage = {
  getItem: (key) => {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") {
        return Promise.resolve(null);
      }
      return Promise.resolve(localStorage.getItem(key));
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createExpoClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  secureStorage,
);
