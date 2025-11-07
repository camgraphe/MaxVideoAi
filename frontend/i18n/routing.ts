import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@/i18n/locales';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  pathnames: {
    '/': '/',
    '/models': {
      en: '/models',
      fr: '/modeles',
      es: '/modelos',
    },
    '/models/[slug]': {
      en: '/models/[slug]',
      fr: '/modeles/[slug]',
      es: '/modelos/[slug]',
    },
    '/pricing': {
      en: '/pricing',
      fr: '/tarifs',
      es: '/precios',
    },
    '/examples': {
      en: '/examples',
      fr: '/galerie',
      es: '/galeria',
    },
    '/pricing-calculator': {
      en: '/pricing-calculator',
      fr: '/simulateur-prix',
      es: '/calculadora-precio',
    },
    '/ai-video-engines': {
      en: '/ai-video-engines',
      fr: '/comparatif',
      es: '/comparativa',
    },
  },
});
