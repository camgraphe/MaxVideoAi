import { getLocale, getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { AbstractIntlMessages } from 'next-intl';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import type { Dictionary, Locale } from '@/lib/i18n/types';

const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';

function normalizeLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
  return locales.includes(candidate as AppLocale) ? (candidate as Locale) : null;
}

async function resolveCookieLocale(): Promise<Locale | null> {
  try {
    const cookieStore = await cookies();
    return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? normalizeLocale(cookieStore.get(NEXT_LOCALE_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function resolveLocale(): Promise<Locale> {
  const detected = normalizeLocale((await getLocale()) as AppLocale | null);
  if (detected && detected !== defaultLocale) return detected;
  const cookieLocale = await resolveCookieLocale();
  if (cookieLocale) return cookieLocale;
  if (detected) return detected;
  return defaultLocale;
}

export function deserializeMessages(messages: AbstractIntlMessages): Dictionary {
  return JSON.parse(JSON.stringify(messages)) as Dictionary;
}

export async function resolveDictionary(options?: {
  locale?: Locale;
}): Promise<{ locale: Locale; dictionary: Dictionary; fallback: Dictionary }> {
  const locale = options?.locale ?? (await resolveLocale());
  const dictionary = deserializeMessages(await getMessages({ locale }));
  const fallback =
    locale === defaultLocale ? dictionary : deserializeMessages(await getMessages({ locale: defaultLocale }));
  return { locale, dictionary, fallback };
}
