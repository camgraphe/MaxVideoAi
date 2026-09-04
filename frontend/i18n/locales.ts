export const locales = ['en', 'fr', 'es'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function normalizeAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}

export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

export const localeRegions: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-419',
};

export const localePathnames: Record<AppLocale, string> = {
  en: '',
  fr: 'fr',
  es: 'es',
};
