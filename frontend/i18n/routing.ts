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
    '/examples/[model]': {
      en: '/examples/[model]',
      fr: '/galerie/[model]',
      es: '/galeria/[model]',
    },
    '/ai-video-engines': {
      en: '/ai-video-engines',
      fr: '/comparatif',
      es: '/comparativa',
    },
    '/blog': {
      en: '/blog',
      fr: '/blog',
      es: '/blog',
    },
    '/blog/[slug]': {
      en: '/blog/[slug]',
      fr: '/blog/[slug]',
      es: '/blog/[slug]',
    },
    '/status': {
      en: '/status',
      fr: '/status',
      es: '/status',
    },
    '/legal/terms': {
      en: '/legal/terms',
      fr: '/legal/terms',
      es: '/legal/terms',
    },
    '/legal/privacy': {
      en: '/legal/privacy',
      fr: '/legal/privacy',
      es: '/legal/privacy',
    },
    '/legal/acceptable-use': {
      en: '/legal/acceptable-use',
      fr: '/legal/acceptable-use',
      es: '/legal/acceptable-use',
    },
    '/legal/cookies': {
      en: '/legal/cookies',
      fr: '/legal/cookies',
      es: '/legal/cookies',
    },
    '/legal/mentions': {
      en: '/legal/mentions',
      fr: '/legal/mentions',
      es: '/legal/mentions',
    },
    '/legal/takedown': {
      en: '/legal/takedown',
      fr: '/legal/takedown',
      es: '/legal/takedown',
    },
    '/legal/subprocessors': {
      en: '/legal/subprocessors',
      fr: '/legal/subprocessors',
      es: '/legal/subprocessors',
    },
    '/legal/cookies-list': {
      en: '/legal/cookies-list',
      fr: '/legal/cookies-list',
      es: '/legal/cookies-list',
    },
    '/docs': {
      en: '/docs',
      fr: '/docs',
      es: '/docs',
    },
    '/docs/[slug]': {
      en: '/docs/[slug]',
      fr: '/docs/[slug]',
      es: '/docs/[slug]',
    },
  },
});
