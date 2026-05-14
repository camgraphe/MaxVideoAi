import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance20FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-0-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'BYTEDANCE FAST DRAFT ROUTE',
    subtitleHighlightTerms: ['draft passes', 'timing tests', 'A/B motion checks'],
    primaryCtaHref: '/app?engine=seedance-2-0-fast',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareProduction',
        href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#seedance-2-0-fast-pricing',
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
    anchorHref: '/pricing#seedance-2-0-fast-pricing',
    presets: [
      { id: '5s-480p', seconds: 5, resolution: '480p', labelKey: 'entryDraft', noteKey: 'fiveSeconds480pAudioIncluded' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview', noteKey: 'eightSeconds720pAudioIncluded' },
      {
        id: '10s-720p',
        seconds: 10,
        resolution: '720p',
        labelKey: 'commonProductionCheck',
        noteKey: 'tenSeconds720pAudioIncluded',
        highlightKey: 'mostPopular',
      },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration' },
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
