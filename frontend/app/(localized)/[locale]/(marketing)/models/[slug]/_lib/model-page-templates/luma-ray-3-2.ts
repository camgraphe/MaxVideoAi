import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaRay32TemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-ray-3-2',
  intent: 'production',
  hero: {
    eyebrow: 'LUMA MODIFY + REFRAME ROUTE',
    subtitleHighlightTerms: ['source-video Modify', 'Reframe', 'silent video outputs'],
    primaryCtaHref: '/app?engine=luma-ray-3-2',
    secondaryCtaHref: '/examples/luma',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#luma-ray-3-2-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
      { labelKey: 'modelSpecs', href: '#specs', icon: 'video' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#luma-ray-3-2-pricing',
    presets: [
      { id: '5s-540p', seconds: 5, resolution: '540p', labelKey: 'motionDraft' },
      { id: '5s-720p', seconds: 5, resolution: '720p', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'deliveryRender' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo1080p' },
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
