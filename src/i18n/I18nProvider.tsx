'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Locale } from './config';
import type { Dictionary } from './get-dictionary';
import { en } from './dictionaries/en';
import { ru } from './dictionaries/ru';

const dictionaries: Record<Locale, Dictionary> = { en, ru };

type I18nContextValue = {
  locale: Locale;
  dict: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, dict: dictionaries[locale] }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}