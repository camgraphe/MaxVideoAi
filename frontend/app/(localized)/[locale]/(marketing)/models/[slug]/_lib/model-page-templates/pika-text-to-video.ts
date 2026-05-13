import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const pikaTextToVideoTemplateConfig: ModelPageTemplateConfig = {
  slug: 'pika-text-to-video',
  intent: 'draft',
  hero: {
    eyebrow: 'PIKA STYLIZED VIDEO ROUTE',
    subtitleHighlightTerms: ['stylized short clips', 'image-to-video starts', 'social loops'],
    primaryCtaHref: '/app?engine=pika-text-to-video',
    secondaryCtaHref: '/examples/pika',
    quickLinks: [
      {
        labelKey: 'compareHailuo',
        href: '/ai-video-engines/minimax-hailuo-02-text-vs-pika-text-to-video?order=pika-text-to-video',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#pika-text-to-video-pricing',
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
    anchorHref: '/pricing#pika-text-to-video-pricing',
    presets: [
      { id: '5s-720p', seconds: 5, resolution: '720p', labelKey: 'stylizedDraft' },
      {
        id: '10s-720p',
        seconds: 10,
        resolution: '720p',
        labelKey: 'socialLoop',
        highlightKey: 'mostPopular',
      },
      { id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'commonProductionCheck' },
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
