import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const nanoBananaLiteTemplateConfig: ModelPageTemplateConfig = {
  slug: 'nano-banana-lite',
  intent: 'draft',
  hero: {
    eyebrow: 'GOOGLE FAST IMAGE MODEL',
    subtitleHighlightTerms: ['fast 1K image generation', 'local edits', 'high-volume drafts'],
    primaryCtaHref: '/app/image?engine=nano-banana-lite',
    secondaryCtaHref: '/models/nano-banana-2',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=nano-banana-lite', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#nano-banana-lite-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#nano-banana-lite-pricing',
    presets: [
      { id: '1k-image', imageResolution: '1k', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
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
