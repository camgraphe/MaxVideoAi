import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaRay2FlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-ray-2-flash',
  intent: 'draft',
  hero: {
    eyebrow: 'LUMA FAST DRAFT ROUTE',
    subtitleHighlightTerms: ['fast Luma drafts', 'Modify and Reframe tests', 'lower-cost iteration'],
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
