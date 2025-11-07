import localizedSlugConfig from '@/config/localized-slugs.json';
import type { AppLocale } from '@/i18n/locales';
import { locales } from '@/i18n/locales';

type SlugKey = keyof typeof localizedSlugConfig;

export const localizedSlugs: Record<AppLocale, Record<SlugKey, string>> = locales.reduce(
  (acc, locale) => {
    acc[locale] = Object.entries(localizedSlugConfig).reduce<Record<SlugKey, string>>((map, [key, value]) => {
      map[key as SlugKey] = value[locale];
      return map;
    }, {} as Record<SlugKey, string>);
    return acc;
  },
  {} as Record<AppLocale, Record<SlugKey, string>>
);

export type LocalizedSlugKey = SlugKey;

export function buildSlugMap(key: LocalizedSlugKey): Record<AppLocale, string> {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    acc[locale] = localizedSlugs[locale][key];
    return acc;
  }, {} as Record<AppLocale, string>);
}
