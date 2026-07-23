import {
  getSession,
  onAuthStateChange,
  signInWithOtp,
  signInWithPassword,
  signOut,
  verifyOtp,
  type Session,
} from "@repo/auth";
import { create } from "zustand";

import { supabase } from "../lib/supabase";
import { trpcClient } from "../lib/trpc";

type AuthStatus = "loading" | "signedIn" | "signedOut";

/** Why this device is (or isn't) receiving pushes — surfaced in Settings so an
 *  operator can tell Phase 1 isn't live instead of it silently no-oping. */
export type PushRegistrationStatus =
  "pending" | "registered" | "no-project-id" | "permission-denied" | "token-error" | "expo-go";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Expo push token registered for this device (for logout deregistration). */
  pushToken: string | null;
  pushStatus: PushRegistrationStatus;
  setPushToken: (token: string | null) => void;
  setPushStatus: (status: PushRegistrationStatus) => void;
  /** Restore the session and subscribe to changes. Returns an unsubscribe fn. */
  initialize: () => () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  confirmOtp: (phone: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  pushToken: null,
  pushStatus: "pending",
  setPushToken: (token) => set({ pushToken: token }),
  setPushStatus: (pushStatus) => set({ pushStatus }),

  initialize: () => {
    const apply = (session: Session | null): void => {
      set({ session, status: session ? "signedIn" : "signedOut" });
    };
    // Restore any persisted session, then keep in sync via a single subscription.
    void getSession(supabase).then(apply);
    return onAuthStateChange(supabase, apply);
  },

  signInWithEmail: (email, password) => signInWithPassword(supabase, { email, password }),
  requestOtp: (phone) => signInWithOtp(supabase, { phone }),
  confirmOtp: (phone, token) => verifyOtp(supabase, { phone, token }),
  logout: async () => {
    // Deregister the device WHILE still authenticated (the token is gone after
    // signOut). Best-effort — never block logout on it.
    const token = get().pushToken;
    if (token) {
      await trpcClient.notification.deregisterDevice
        .mutate({ expoPushToken: token })
        .catch(() => undefined);
    }
    set({ pushToken: null });
    // Queued attendance is NOT purged here: the drain already refuses entries whose
    // userId ≠ the signed-in user (§Auth), and unsynced marks must never be silently
    // dropped (OFFLINE_STRATEGY). The logout UI confirms + purgeUser() explicitly.
    await signOut(supabase);
  },
}));
