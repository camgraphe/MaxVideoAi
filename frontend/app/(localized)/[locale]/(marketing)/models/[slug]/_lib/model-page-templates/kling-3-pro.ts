import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const kling3ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-3-pro',
  intent: 'production',
  hero: {
    eyebrow: 'KLING PRO VIDEO MODEL',
    subtitleHighlightTerms: ['storyboard control', 'native audio', '15s production clips'],
    primaryCtaHref: '/app?engine=kling-3-pro',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'compareVeo',
        href: '/ai-video-engines/kling-3-pro-vs-veo-3-1',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-3-pro-pricing',
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
    anchorHref: '/pricing#kling-3-pro-pricing',
    presets: [
      { id: '5s-1080p-audio', seconds: 5, resolution: '1080p', audio: true, labelKey: 'storyboardPass' },
      {
        id: '10s-1080p-audio',
        seconds: 10,
        resolution: '1080p',
        audio: true,
        labelKey: 'commonProductionCheck',
        highlightKey: 'mostPopular',
      },
      { id: '15s-1080p-audio', seconds: 15, resolution: '1080p', audio: true, labelKey: 'nativeAudioShot' },
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
