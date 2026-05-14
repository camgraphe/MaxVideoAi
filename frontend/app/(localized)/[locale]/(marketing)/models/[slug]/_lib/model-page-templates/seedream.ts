import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedreamTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedream',
  intent: 'reference-prep',
  hero: {
    eyebrow: 'REFERENCE IMAGE PREP MODEL',
    subtitleHighlightTerms: ['clean still references', 'product frames', 'video reference prep'],
    primaryCtaHref: '/app/image?engine=seedream',
    secondaryCtaHref: '/models/seedance-2-0',
    quickLinks: [
      {
        labelKey: 'openImageWorkspace',
        href: '/app/image?engine=seedream',
        icon: 'image',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#seedream-pricing',
        icon: 'pricing',
      },
      {
        labelKey: 'promptExamples',
        href: '#prompting',
        icon: 'prompt',
      },
    ],
  },
  pricing: {
    anchorHref: '/pricing#seedream-pricing',
    presets: [
      {
        id: '2k-image',
        imageResolution: '2K',
        imageQuality: 'medium',
        labelKey: 'twoKImage',
        noteKey: 'singleGeneratedStill',
      },
      {
        id: '4k-image',
        imageResolution: '4K',
        imageQuality: 'high',
        labelKey: 'fourKImage',
        noteKey: 'highResolutionStill',
        highlightKey: 'mostPopular',
      },
      {
        id: 'reference-images',
        imageResolution: '2K',
        imageQuality: 'medium',
        quantity: 4,
        labelKey: 'referenceBatch',
        noteKey: 'fourGeneratedImages',
      },
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
