import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const veo31FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'veo-3-1-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'GOOGLE FAST VIDEO ROUTE',
    subtitleHighlightTerms: ['faster Veo drafts', 'optional native audio', 'first-last frame tests'],
    primaryCtaHref: '/app?engine=veo-3-1-fast',
    secondaryCtaHref: '/examples/veo',
    quickLinks: [
      {
        labelKey: 'compareStandard',
        href: '/ai-video-engines/veo-3-1-vs-veo-3-1-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#veo-3-1-fast-pricing',
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
    anchorHref: '/pricing#veo-3-1-fast-pricing',
    presets: [
      { id: '4s-720p', seconds: 4, resolution: '720p', labelKey: 'entryDraft', noteKey: 'fourSeconds720pAudioOff' },
      { id: '6s-720p-audio', seconds: 6, resolution: '720p', audio: true, labelKey: 'standardPreview', noteKey: 'sixSeconds720pAudioOn' },
      {
        id: '8s-1080p-audio',
        seconds: 8,
        resolution: '1080p',
        audio: true,
        labelKey: 'commonProductionCheck',
        noteKey: 'eightSeconds1080pAudioOn',
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
