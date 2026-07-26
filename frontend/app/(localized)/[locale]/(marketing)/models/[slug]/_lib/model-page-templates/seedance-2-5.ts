import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance25TemplateConfig = {
  slug: 'seedance-2-5',
  intent: 'prelaunch',
  hero: {
    eyebrow: 'COMING SOON · WHAT’S NEW',
    subtitleHighlightTerms: ['Coming soon', 'What’s new'],
    primaryCtaHref: '/models/seedance-2-0',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'availableSeedance',
        href: '/models/seedance-2-0',
        icon: 'video',
      },
      {
        labelKey: 'seedanceExamples',
        href: '/examples/seedance',
        icon: 'examples',
      },
    ],
  },
  pricing: {
    enabled: false,
    anchorHref: '#availability',
    presets: [],
  },
  sections: {
    examples: false,
    prompting: false,
    tips: false,
    compare: false,
    specs: false,
    safety: true,
    faq: true,
  },
} satisfies ModelPageTemplateConfig;
