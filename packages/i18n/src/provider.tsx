"use client";

import { DEFAULT_LOCALE, type LocaleCode } from "@repo/constants";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getDictionary, type Dictionary } from "./dictionary";

interface I18nValue {
  locale: LocaleCode;
  dict: Dictionary;
}

/**
 * Framework-neutral i18n provider (web + RN). next-intl (web) and i18next
 * (mobile) adapters wrap these dictionaries when screens are built; M0 ships the
 * shared catalog + provider only. Dev PRD §3, §8.11.
 */
const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  dict: getDictionary(DEFAULT_LOCALE),
});

export function LocaleProvider({
  locale = DEFAULT_LOCALE,
  children,
}: {
  locale?: LocaleCode;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => ({ locale, dict: getDictionary(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nValue {
  return useContext(I18nContext);
}
