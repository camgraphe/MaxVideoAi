import type { ModelPageTemplateConfig } from '../model-page-template-types';

// Prepare the normal model layout; model-registry.json still closes every public surface.
export const seedance25FlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-5-flash',
  intent: 'production',
  hero: {
    eyebrow: 'ByteDance · Model preview',
    subtitleHighlightTerms: [],
    primaryCtaHref: '/models',
    secondaryCtaHref: '/models/seedance-2-5',
    quickLinks: [{ labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' }],
  },
  pricing: { enabled: false, anchorHref: '/models', presets: [] },
  sections: {
    examples: false,
    prompting: true,
    tips: true,
    compare: false,
    specs: true,
    safety: true,
    faq: true,
  },
};
