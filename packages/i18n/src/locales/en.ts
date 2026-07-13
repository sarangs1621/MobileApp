/**
 * English catalog — the SOURCE OF TRUTH for the dictionary shape. `Dictionary =
 * typeof en`, so every other locale must supply the same keys AND the same function
 * signatures (interpolation/pluralization live per-locale, in each locale's own
 * function). Growing incrementally, one feature area per commit (Phase 4).
 *
 * Plain strings for static copy; function-valued entries for anything that
 * interpolates a value or pluralizes — no i18n runtime dependency needed.
 */
export const en = {
  common: {
    appName: "School Portal",
    loading: "Loading…",
    retry: "Retry",
    somethingWentWrong: "Something went wrong",
  },
  auth: {
    subtitle: "School Portal — sign in to continue",
    staff: "Staff",
    parent: "Parent",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    phone: "Phone number",
    verificationCode: "Verification code",
    verifyCode: "Verify code",
    sendCode: "Send code",
  },
};

/** The dictionary shape — keys AND function signatures are enforced across locales. */
export type Dictionary = typeof en;
