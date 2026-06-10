import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaUni1TemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-uni-1',
  intent: 'reference-prep',
  hero: {
    eyebrow: 'LUMA IMAGE GENERATION ROUTE',
    subtitleHighlightTerms: ['2K image generation', 'image edits', 'multi-reference guidance'],
    primaryCtaHref: '/app/image?engine=luma-uni-1',
    secondaryCtaHref: '/app/image?engine=luma-uni-1',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=luma-uni-1', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#luma-uni-1-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#luma-uni-1-pricing',
    presets: [
      { id: '2k-image', imageResolution: '2K', mode: 't2i', labelKey: 'twoKImage', noteKey: 'singleGeneratedStill' },
      { id: 'single-edit', imageResolution: '2K', mode: 'i2i', referenceImageCount: 0, labelKey: 'singleEdit', noteKey: 'sourceImageEdit' },
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
