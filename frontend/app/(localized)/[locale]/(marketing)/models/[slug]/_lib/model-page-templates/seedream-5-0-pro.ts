import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedream50ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedream-5-0-pro',
  intent: 'production',
  hero: {
    eyebrow: 'PROFESSIONAL IMAGE MODEL',
    subtitleHighlightTerms: ['professional still images', 'dense infographics', '4K visual production'],
    primaryCtaHref: '/app/image?engine=seedream-5-0-pro',
    secondaryCtaHref: '/models/seedream',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=seedream-5-0-pro', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#seedream-5-0-pro-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#seedream-5-0-pro-pricing',
    presets: [
      { id: '2k-image', imageResolution: '2K', imageQuality: 'medium', labelKey: 'twoKImage' },
      { id: '4k-image', imageResolution: '4K', imageQuality: 'high', labelKey: 'fourKImage', highlightKey: 'mostPopular' },
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
