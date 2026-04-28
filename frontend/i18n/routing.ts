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
    '/models/video': {
      en: '/models/video',
      fr: '/modeles/video',
      es: '/modelos/video',
    },
    '/models/image': {
      en: '/models/image',
      fr: '/modeles/image',
      es: '/modelos/image',
    },
    '/pricing': {
      en: '/pricing',
      fr: '/tarifs',
      es: '/precios',
    },
    '/tools': {
      en: '/tools',
      fr: '/outils',
      es: '/herramientas',
    },
    '/tools/angle': {
      en: '/tools/angle',
      fr: '/outils/angle',
      es: '/herramientas/angle',
    },
    '/tools/upscale': {
      en: '/tools/upscale',
      fr: '/outils/upscale',
      es: '/herramientas/upscale',
    },
    '/tools/character-builder': {
      en: '/tools/character-builder',
      fr: '/outils/character-builder',
      es: '/herramientas/character-builder',
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
    '/ai-video-engines/[slug]': {
      en: '/ai-video-engines/[slug]',
      fr: '/comparatif/[slug]',
      es: '/comparativa/[slug]',
    },
    '/ai-video-engines/best-for': {
      en: '/ai-video-engines/best-for',
      fr: '/comparatif/best-for',
      es: '/comparativa/best-for',
    },
    '/ai-video-engines/best-for/[usecase]': {
      en: '/ai-video-engines/best-for/[usecase]',
      fr: '/comparatif/best-for/[usecase]',
      es: '/comparativa/best-for/[usecase]',
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
    '/about': {
      en: '/about',
      fr: '/a-propos',
      es: '/acerca-de',
    },
    '/status': {
      en: '/status',
      fr: '/statut',
      es: '/estado',
    },
    '/company': {
      en: '/company',
      fr: '/entreprise',
      es: '/empresa',
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
