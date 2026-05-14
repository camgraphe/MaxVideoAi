import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const kling25TurboTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-2-5-turbo',
  intent: 'draft',
  hero: {
    eyebrow: 'SUPPORTED KLING SILENT DRAFT ROUTE',
    subtitleHighlightTerms: ['silent 1080p drafts', 'text or image starts', 'negative prompt control'],
    primaryCtaHref: '/app?engine=kling-2-5-turbo',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/models/kling-3-standard',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-2-5-turbo-pricing',
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
    anchorHref: '/pricing#kling-2-5-turbo-pricing',
    presets: [
      { id: '5s-1080p', seconds: 5, resolution: '1080p', labelKey: 'entryDraft' },
      {
        id: '10s-1080p',
        seconds: 10,
        resolution: '1080p',
        labelKey: 'commonProductionCheck',
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
