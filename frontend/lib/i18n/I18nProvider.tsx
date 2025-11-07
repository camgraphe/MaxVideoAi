'use client';

import { NextIntlClientProvider } from 'next-intl';
import { createContext, useContext, useMemo } from 'react';
import type { Dictionary, Locale } from '@/lib/i18n/types';

type TranslateFn = <T = unknown>(path: string, fallback?: T) => T | undefined;

interface I18nContextValue {
  locale: Locale;
  dictionary: Dictionary;
  fallback: Dictionary;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath<T>(source: Record<string, unknown>, path: string): T | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
  return value as T | undefined;
}

interface I18nProviderProps {
  locale: Locale;
  dictionary: Dictionary;
  fallback: Dictionary;
  children: React.ReactNode;
}

export function I18nProvider({ locale, dictionary, fallback, children }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(() => {
    const translate: TranslateFn = (path, defaultValue) => {
      const primary = resolvePath(dictionary as unknown as Record<string, unknown>, path);
      if (primary !== undefined) {
        return primary as typeof defaultValue;
      }
      const fallbackValue = resolvePath(fallback as unknown as Record<string, unknown>, path);
      if (fallbackValue !== undefined) {
        return fallbackValue as typeof defaultValue;
      }
      return defaultValue as typeof defaultValue;
    };
    return {
      locale,
      dictionary,
      fallback,
      t: translate,
    };
  }, [dictionary, fallback, locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={dictionary}>
      <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    </NextIntlClientProvider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
