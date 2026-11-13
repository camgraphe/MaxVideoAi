import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedream55TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedream-5-5',
  intent: 'production',
  hero: {
    eyebrow: 'BYTEDANCE IMAGE MODEL',
    subtitleHighlightTerms: ['Seedream 5.5', 'reference images'],
    primaryCtaHref: '/app/image?engine=seedream-5-5',
    secondaryCtaHref: '/models/seedream-5-0-flash',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=seedream-5-5', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#seedream-5-5-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#seedream-5-5-pricing',
    presets: [
      { id: '1k-image', imageResolution: '1K', mode: 't2i', labelKey: 'oneKImage', noteKey: 'singleGeneratedStill' },
      { id: '1-5k-image', imageResolution: '1.5K', mode: 't2i', labelKey: 'oneHalfKImage', noteKey: 'singleGeneratedStill' },
      { id: '2k-image', imageResolution: '2K', mode: 't2i', labelKey: 'twoKImage', noteKey: 'singleGeneratedStill' },
    ],
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
