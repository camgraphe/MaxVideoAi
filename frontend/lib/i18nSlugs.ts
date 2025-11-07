import type { AppLocale } from '@/i18n/locales';
import { locales } from '@/i18n/locales';

type SlugKey = 'models' | 'pricing' | 'gallery' | 'compare' | 'blog';

export const localizedSlugs: Record<AppLocale, Record<SlugKey, string>> = {
  en: {
    models: 'models',
    pricing: 'pricing',
    gallery: 'examples',
    compare: 'ai-video-engines',
    blog: 'blog',
  },
  fr: {
    models: 'modeles',
    pricing: 'tarifs',
    gallery: 'galerie',
    compare: 'comparatif',
    blog: 'blog',
  },
  es: {
    models: 'modelos',
    pricing: 'precios',
    gallery: 'galeria',
    compare: 'comparativa',
    blog: 'blog',
  },
};

export type LocalizedSlugKey = SlugKey;

export function buildSlugMap(key: LocalizedSlugKey): Record<AppLocale, string> {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    acc[locale] = localizedSlugs[locale][key];
    return acc;
  }, {} as Record<AppLocale, string>);
}
