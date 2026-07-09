import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const nanoBananaTemplateConfig: ModelPageTemplateConfig = {
  slug: 'nano-banana',
  intent: 'draft',
  hero: {
    eyebrow: 'GOOGLE FAST IMAGE ROUTE',
    subtitleHighlightTerms: ['fast still drafts', 'reference edits', 'batch image variants'],
    primaryCtaHref: '/app/image?engine=nano-banana',
    secondaryCtaHref: '/examples?engine=nano-banana',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=nano-banana', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#nano-banana-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#nano-banana-pricing',
    presets: [
      { id: 'single-square', imageResolution: 'square_hd', labelKey: 'entryDraft' },
      { id: '4x-square', imageResolution: 'square_hd', quantity: 4, labelKey: 'imageBatch', highlightKey: 'mostPopular' },
      { id: '8x-square', imageResolution: 'square_hd', quantity: 8, labelKey: 'standardPreview' },
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
