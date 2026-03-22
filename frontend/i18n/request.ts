import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import frMessages from '@/messages/fr.json';

const LOCALE_MESSAGES = {
  en: enMessages,
  fr: frMessages,
  es: esMessages,
} satisfies Record<AppLocale, Record<string, unknown>>;

function isAppLocale(candidate: string | undefined | null): candidate is AppLocale {
  if (!candidate) {
    return false;
  }
  return (locales as readonly string[]).includes(candidate);
}

function loadMessages(locale: AppLocale) {
  return LOCALE_MESSAGES[locale];
}

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const segmentLocale = await requestLocale;

  const resolvedLocale =
    (isAppLocale(locale) && locale) ||
    (isAppLocale(segmentLocale) && segmentLocale) ||
    (isAppLocale(cookieLocale) && cookieLocale) ||
    defaultLocale;

  return {
    locale: resolvedLocale,
    messages: loadMessages(resolvedLocale),
  };
});
