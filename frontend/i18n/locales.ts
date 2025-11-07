export const locales = ['en', 'fr', 'es'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';

export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

export const localeRegions: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

export const localePathnames: Record<AppLocale, string> = {
  en: '',
  fr: 'fr',
  es: 'es',
};
