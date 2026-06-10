import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaUni1MaxTemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-uni-1-max',
  intent: 'production',
  hero: {
    eyebrow: 'LUMA PREMIUM IMAGE ROUTE',
    subtitleHighlightTerms: ['higher-fidelity Uni-1 stills', 'precise image revisions', 'reference-led edits'],
    primaryCtaHref: '/app/image?engine=luma-uni-1-max',
    secondaryCtaHref: '/app/image?engine=luma-uni-1-max',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=luma-uni-1-max', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#luma-uni-1-max-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#luma-uni-1-max-pricing',
    presets: [
      { id: '2k-hero-image', imageResolution: '2K', mode: 't2i', labelKey: 'twoKHeroImage', noteKey: 'singleGeneratedStill' },
      { id: 'hero-edit', imageResolution: '2K', mode: 'i2i', referenceImageCount: 0, labelKey: 'heroEdit', noteKey: 'sourceImageEdit' },
      {
        id: 'reference-edit-set',
        imageResolution: '2K',
        mode: 'i2i',
        referenceImageCount: 3,
        labelKey: 'referenceEditSet',
        noteKey: 'sourcePlusThreeReferences',
        highlightKey: 'mostPopular',
      },
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
