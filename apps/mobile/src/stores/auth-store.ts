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

type AuthStatus = "loading" | "signedIn" | "signedOut";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Restore the session and subscribe to changes. Returns an unsubscribe fn. */
  initialize: () => () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  confirmOtp: (phone: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  session: null,

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
  logout: () => signOut(supabase),
}));
