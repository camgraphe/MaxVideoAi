import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance25TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-5',
  intent: 'production',
  hero: {
    eyebrow: 'BYTEDANCE NEXT-GEN VIDEO MODEL',
    subtitleHighlightTerms: ['30-second storytelling', 'cinematic continuity', 'camera control'],
    primaryCtaHref: '/examples/seedance',
    secondaryCtaHref: '/models/seedance-2-0',
    quickLinks: [
      { labelKey: 'seedanceExamples', href: '/examples/seedance', icon: 'examples' },
      { labelKey: 'availableSeedance', href: '/models/seedance-2-0', icon: 'video' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: false,
    anchorHref: '#specs',
    presets: [],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: false,
    specs: true,
    safety: true,
    faq: true,
  },
};
