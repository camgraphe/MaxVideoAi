import { defaultLocale, isAppLocale, type AppLocale } from '@/i18n/locales';

/** Request callers supply cookie values; never retain a visitor's preference. */
export function resolveCookieLocale(primary: unknown, legacy: unknown): AppLocale {
  return [primary, legacy].find(isAppLocale) ?? defaultLocale;
}
