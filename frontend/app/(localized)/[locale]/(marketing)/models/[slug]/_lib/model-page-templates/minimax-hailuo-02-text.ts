import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const minimaxHailuo02TemplateConfig: ModelPageTemplateConfig = {
  slug: 'minimax-hailuo-02-text',
  intent: 'draft',
  hero: {
    eyebrow: 'MINIMAX BUDGET MOTION ROUTE',
    subtitleHighlightTerms: ['budget motion drafts', 'physics-aware tests', 'silent storyboard clips'],
    primaryCtaHref: '/app?engine=minimax-hailuo-02-text',
    secondaryCtaHref: '/examples/hailuo',
    quickLinks: [
      {
        labelKey: 'comparePika',
        href: '/ai-video-engines/minimax-hailuo-02-text-vs-pika-text-to-video',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#minimax-hailuo-02-text-pricing',
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
    anchorHref: '/pricing#minimax-hailuo-02-text-pricing',
    presets: [
      { id: '6s-512p', seconds: 6, resolution: '512P', labelKey: 'entryDraft' },
      {
        id: '10s-768p',
        seconds: 10,
        resolution: '768P',
        labelKey: 'motionDraft',
        highlightKey: 'mostPopular',
      },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo768p' },
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
