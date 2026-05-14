import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const wan25TemplateConfig: ModelPageTemplateConfig = {
  slug: 'wan-2-5',
  intent: 'draft',
  hero: {
    eyebrow: 'WAN SUPPORTED AUDIO DRAFT ROUTE',
    subtitleHighlightTerms: ['audio-ready 5-10s clips', 'text or image starts', '480p to 1080p checks'],
    primaryCtaHref: '/app?engine=wan-2-5',
    secondaryCtaHref: '/examples/wan',
    quickLinks: [
      {
        labelKey: 'compareSora',
        href: '/ai-video-engines/sora-2-vs-wan-2-5?order=wan-2-5',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#wan-2-5-pricing',
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
    anchorHref: '/pricing#wan-2-5-pricing',
    presets: [
      { id: '5s-480p-audio', seconds: 5, resolution: '480p', audio: true, labelKey: 'entryDraft' },
      { id: '10s-720p-audio', seconds: 10, resolution: '720p', audio: true, labelKey: 'standardPreview' },
      {
        id: '10s-1080p-audio',
        seconds: 10,
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
