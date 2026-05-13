import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const veo31LiteTemplateConfig: ModelPageTemplateConfig = {
  slug: 'veo-3-1-lite',
  intent: 'draft',
  hero: {
    eyebrow: 'GOOGLE LOWER-COST VIDEO ROUTE',
    subtitleHighlightTerms: ['lower-cost Veo drafts', 'audio included', 'short prompt tests'],
    primaryCtaHref: '/app?engine=veo-3-1-lite',
    secondaryCtaHref: '/examples/veo',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#veo-3-1-lite-pricing',
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
    anchorHref: '/pricing#veo-3-1-lite-pricing',
    presets: [
      { id: '4s-720p-audio', seconds: 4, resolution: '720p', audio: true, labelKey: 'entryDraft' },
      { id: '6s-720p-audio', seconds: 6, resolution: '720p', audio: true, labelKey: 'standardPreview' },
      {
        id: '8s-1080p-audio',
        seconds: 8,
        resolution: '1080p',
        audio: true,
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
