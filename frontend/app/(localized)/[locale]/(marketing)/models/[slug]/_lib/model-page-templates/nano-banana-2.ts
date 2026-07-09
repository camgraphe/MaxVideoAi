import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const nanoBanana2TemplateConfig: ModelPageTemplateConfig = {
  slug: 'nano-banana-2',
  intent: 'production',
  hero: {
    eyebrow: 'GOOGLE GROUNDED IMAGE MODEL',
    subtitleHighlightTerms: ['grounded image generation', 'wide aspect ratios', 'multi-reference edits'],
    primaryCtaHref: '/app/image?engine=nano-banana-2',
    secondaryCtaHref: '/examples?engine=nano-banana-2',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=nano-banana-2', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#nano-banana-2-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#nano-banana-2-pricing',
    presets: [
      { id: '0-5k-image', imageResolution: '0.5k', labelKey: 'entryDraft' },
      { id: '1k-image', imageResolution: '1k', labelKey: 'standardPreview' },
      { id: '4k-image', imageResolution: '4k', labelKey: 'fourKStill', highlightKey: 'mostPopular' },
      { id: '4x-1k-image', imageResolution: '1k', quantity: 4, labelKey: 'referenceEditSet' },
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
