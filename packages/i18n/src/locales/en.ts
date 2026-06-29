/** English catalog (source of truth for the dictionary shape). Minimal in M0. */
export const en = {
  common: {
    appName: "School Portal",
    loading: "Loading…",
    retry: "Retry",
  },
};

/** The dictionary shape — keys are enforced across locales; values are strings. */
export type Dictionary = typeof en;
