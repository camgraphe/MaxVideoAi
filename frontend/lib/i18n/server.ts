import { cookies } from 'next/headers';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n/dictionaries';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';

export function resolveLocale(): Locale {
  const localeCookie = cookies().get(LOCALE_COOKIE)?.value;
  return localeCookie === 'fr' ? 'fr' : 'en';
}

export function resolveDictionary(): { locale: Locale; dictionary: Dictionary; fallback: Dictionary } {
  const locale = resolveLocale();
  return { locale, dictionary: getDictionary(locale), fallback: getDictionary('en') };
}
