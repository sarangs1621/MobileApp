import type { Dictionary } from "./en";

/**
 * Malayalam catalog — must mirror the English shape (type-enforced). Entries marked
 * `TODO(verify-ml)` are machine-translated and need a native-speaker review.
 */
export const ml: Dictionary = {
  common: {
    appName: "സ്കൂൾ പോർട്ടൽ",
    loading: "ലോഡുചെയ്യുന്നു…",
    retry: "വീണ്ടും ശ്രമിക്കുക",
    somethingWentWrong: "എന്തോ പിഴവ് സംഭവിച്ചു", // TODO(verify-ml)
  },
  auth: {
    subtitle: "സ്കൂൾ പോർട്ടൽ — തുടരാൻ സൈൻ ഇൻ ചെയ്യുക", // TODO(verify-ml)
    staff: "ജീവനക്കാർ", // TODO(verify-ml)
    parent: "രക്ഷിതാവ്", // TODO(verify-ml)
    email: "ഇമെയിൽ", // TODO(verify-ml)
    password: "പാസ്‌വേഡ്", // TODO(verify-ml)
    signIn: "സൈൻ ഇൻ ചെയ്യുക", // TODO(verify-ml)
    phone: "ഫോൺ നമ്പർ", // TODO(verify-ml)
    verificationCode: "പരിശോധനാ കോഡ്", // TODO(verify-ml)
    verifyCode: "കോഡ് പരിശോധിക്കുക", // TODO(verify-ml)
    sendCode: "കോഡ് അയയ്ക്കുക", // TODO(verify-ml)
  },
};
