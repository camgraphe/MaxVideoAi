import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';

function isAppLocale(candidate: string | undefined | null): candidate is AppLocale {
  if (!candidate) {
    return false;
  }
  return (locales as readonly string[]).includes(candidate);
}

async function loadMessages(locale: AppLocale) {
  const messages = await import(`@/messages/${locale}.json`);
  return messages.default;
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
    messages: await loadMessages(resolvedLocale),
  };
});
