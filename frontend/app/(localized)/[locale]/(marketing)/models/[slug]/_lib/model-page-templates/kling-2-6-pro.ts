import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const kling26ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-2-6-pro',
  intent: 'specialized',
  hero: {
    eyebrow: 'SUPPORTED KLING AUDIO PRO ROUTE',
    subtitleHighlightTerms: ['native audio', '1080p short clips', 'text-to-video and image-to-video'],
    primaryCtaHref: '/app?engine=kling-2-6-pro',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/kling-2-6-pro-vs-kling-3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-2-6-pro-pricing',
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
    anchorHref: '/pricing#kling-2-6-pro-pricing',
    presets: [
      { id: '5s-1080p', seconds: 5, resolution: '1080p', labelKey: 'entryDraft' },
      { id: '5s-1080p-audio', seconds: 5, resolution: '1080p', audio: true, labelKey: 'nativeAudioShot' },
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
