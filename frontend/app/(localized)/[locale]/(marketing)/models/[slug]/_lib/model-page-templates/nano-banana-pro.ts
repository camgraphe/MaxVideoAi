import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const nanoBananaProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'nano-banana-pro',
  intent: 'specialized',
  hero: {
    eyebrow: 'GOOGLE PRO IMAGE MODEL',
    subtitleHighlightTerms: ['4K campaign stills', 'typography-focused edits', 'multi-image references'],
    primaryCtaHref: '/app/image?engine=nano-banana-pro',
    secondaryCtaHref: '/examples?engine=nano-banana-pro',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=nano-banana-pro', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#nano-banana-pro-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#nano-banana-pro-pricing',
    presets: [
      { id: '2k-image', imageResolution: '2k', labelKey: 'twoKStill' },
      { id: '4k-image', imageResolution: '4k', labelKey: 'fourKStill', highlightKey: 'mostPopular' },
      { id: '4x-2k-image', imageResolution: '2k', quantity: 4, labelKey: 'referenceEditSet' },
    ],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
