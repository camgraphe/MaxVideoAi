import { unstable_cache } from 'next/cache';
import { getLocale, getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
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

export function deserializeMessages(messages: AbstractIntlMessages): Dictionary {
  return JSON.parse(JSON.stringify(messages)) as Dictionary;
}

export async function resolveDictionary(options?: {
  locale?: Locale;
}): Promise<{ locale: Locale; dictionary: Dictionary; fallback: Dictionary }> {
  const locale = options?.locale ?? (await resolveLocale());
  return unstable_cache(
    async () => {
      const dictionary = deserializeMessages(await getMessages({ locale }));
      const fallback =
        locale === defaultLocale ? dictionary : deserializeMessages(await getMessages({ locale: defaultLocale }));
      return { locale, dictionary, fallback };
    },
    ['dictionary', locale],
    { revalidate: 60 * 10, tags: ['dictionary', `dictionary:${locale}`] }
  )();
}
