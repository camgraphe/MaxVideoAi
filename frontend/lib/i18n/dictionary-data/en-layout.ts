import type { Dictionary } from '../dictionary-types';

export const nav: Dictionary['nav'] = {
    brand: 'MaxVideo AI',
    links: [
      { key: 'models', href: '/models' },
      { key: 'examples', href: '/examples' },
      { key: 'pricing', href: '/pricing' },
      { key: 'blog', href: '/blog' },
    ],
    login: 'Log in',
    cta: 'Start a render',
    linkLabels: {
      models: 'Models',
      examples: 'Examples',
      pricing: 'Pricing',
      docs: 'Docs',
      blog: 'Blog',
    },
  };

export const footer: Dictionary['footer'] = {
    links: [
      { label: 'Legal Center', href: '/legal' },
      { label: 'Refund & Return Policy', href: '/return-policy' },
    ],
    brandNote:
      'Independent hub for professional AI video - price before you generate, stay on the latest engines, one workspace for every shot. Works with Sora 2, Veo 3.1, Pika 2.2, MiniMax Hailuo 02, and more. Trademarks belong to their owners.',
    languageLabel: 'Language',
    languages: [
      { locale: 'en', label: 'English' },
      { locale: 'fr', label: 'Français' },
    ],
  };
