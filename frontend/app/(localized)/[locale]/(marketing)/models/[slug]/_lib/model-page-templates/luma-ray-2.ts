import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaRay2TemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-ray-2',
  intent: 'production',
  hero: {
    eyebrow: 'PREVIOUS-GENERATION LUMA ROUTE',
    subtitleHighlightTerms: ['previous-generation Luma route', 'Modify and Reframe', 'Ray 3.2 migration'],
    primaryCtaHref: '/app?engine=lumaRay2',
    secondaryCtaHref: '/examples/luma',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/luma-ray-2-vs-luma-ray-2-flash',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#luma-ray-2-pricing',
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
    anchorHref: '/pricing#luma-ray-2-pricing',
    presets: [
      { id: '5s-720p', seconds: 5, resolution: '720p', labelKey: 'standardPreview' },
      { id: '9s-720p', seconds: 9, resolution: '720p', labelKey: 'commonProductionCheck' },
      {
        id: '9s-1080p',
        seconds: 9,
        resolution: '1080p',
        labelKey: 'deliveryRender',
        highlightKey: 'mostPopular',
      },
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
