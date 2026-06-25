import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance20MiniTemplateConfig: ModelPageTemplateConfig = {
  slug: 'dreamina-seedance-2-0-mini',
  intent: 'draft',
  hero: {
    eyebrow: 'BYTEDANCE VALUE BATCH ROUTE',
    subtitleHighlightTerms: ['lower-cost batches', '480p/720p variants', 'reference-guided edits'],
    primaryCtaHref: '/app?engine=seedance-2-0-mini',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareProduction',
        href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0?order=dreamina-seedance-2-0-mini',
        icon: 'compare',
      },
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast?order=dreamina-seedance-2-0-mini',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#dreamina-seedance-2-0-mini-pricing',
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
    anchorHref: '/pricing#dreamina-seedance-2-0-mini-pricing',
    presets: [
      { id: '4s-480p-16x9', seconds: 4, resolution: '480p', labelKey: 'entryDraft' },
      { id: '8s-480p-9x16', seconds: 8, resolution: '480p', labelKey: 'motionDraft' },
      { id: '8s-720p-16x9', seconds: 8, resolution: '720p', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '15s-720p-16x9', seconds: 15, resolution: '720p', labelKey: 'referenceBatch', noteKey: 'upTo720p' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo720p' },
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
