import { getLocale, getMessages } from 'next-intl/server';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import type { Dictionary, Locale } from '@/lib/i18n/types';

export async function resolveLocale(): Promise<Locale> {
  const detected = (await getLocale()) as AppLocale | null;
  if (detected && locales.includes(detected)) {
    return detected;
  }
  return defaultLocale;
}

export async function resolveDictionary(): Promise<{ locale: Locale; dictionary: Dictionary; fallback: Dictionary }> {
  const locale = await resolveLocale();
  const dictionary = (await getMessages({ locale })) as Dictionary;
  const fallback =
    locale === defaultLocale ? dictionary : ((await getMessages({ locale: defaultLocale })) as Dictionary);
  return { locale, dictionary, fallback };
}
