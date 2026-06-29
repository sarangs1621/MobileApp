import { LOCALES, type LocaleCode } from "@repo/constants";

import { en, type Dictionary } from "./locales/en";
import { ml } from "./locales/ml";

const dictionaries: Record<LocaleCode, Dictionary> = { en, ml };

/** Resolve the catalog for a locale. */
export function getDictionary(locale: LocaleCode): Dictionary {
  return dictionaries[locale];
}

/** Type guard for a supported locale code. */
export function isLocale(value: string): value is LocaleCode {
  return (LOCALES as readonly string[]).includes(value);
}

export type { Dictionary };
