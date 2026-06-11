import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaRay2FlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-ray-2-flash',
  intent: 'draft',
  hero: {
    eyebrow: 'PREVIOUS-GENERATION FAST LUMA ROUTE',
    subtitleHighlightTerms: ['previous-generation fast Luma route', 'Modify and Reframe tests', 'Ray 3.2 migration'],
    primaryCtaHref: '/app?engine=lumaRay2_flash',
    secondaryCtaHref: '/examples/luma',
    quickLinks: [
      {
        labelKey: 'compareProduction',
        href: '/ai-video-engines/luma-ray-2-vs-luma-ray-2-flash?order=luma-ray-2-flash',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#luma-ray-2-flash-pricing',
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
    anchorHref: '/pricing#luma-ray-2-flash-pricing',
    presets: [
      { id: '5s-540p', seconds: 5, resolution: '540p', labelKey: 'entryDraft' },
      { id: '5s-720p', seconds: 5, resolution: '720p', labelKey: 'standardPreview' },
      {
        id: '9s-720p',
        seconds: 9,
        resolution: '720p',
        labelKey: 'motionDraft',
        highlightKey: 'mostPopular',
      },
      { id: '9s-1080p', seconds: 9, resolution: '1080p', labelKey: 'commonProductionCheck' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo1080p' },
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
