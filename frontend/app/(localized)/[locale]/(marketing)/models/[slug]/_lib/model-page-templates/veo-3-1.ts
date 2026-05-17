import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const veo31TemplateConfig: ModelPageTemplateConfig = {
  slug: 'veo-3-1',
  intent: 'production',
  hero: {
    eyebrow: 'GOOGLE PREMIUM VIDEO MODEL',
    subtitleHighlightTerms: ['short polished clips', 'native audio', 'up to 4K'],
    primaryCtaHref: '/app?engine=veo-3-1',
    secondaryCtaHref: '/examples/veo',
    quickLinks: [
      {
        labelKey: 'compareKling',
        href: '/ai-video-engines/kling-3-pro-vs-veo-3-1?order=veo-3-1',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#veo-3-1-pricing',
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
    anchorHref: '/pricing#veo-3-1-pricing',
    presets: [
      { id: '4s-720p-audio', seconds: 4, resolution: '720p', audio: true, labelKey: 'polishedShort' },
      {
        id: '6s-1080p-audio',
        seconds: 6,
        resolution: '1080p',
        audio: true,
        labelKey: 'nativeAudioShot',
        highlightKey: 'mostPopular',
      },
      { id: '8s-1080p-audio', seconds: 8, resolution: '1080p', audio: true, labelKey: 'commonProductionCheck' },
      { id: '8s-4k-audio', seconds: 8, resolution: '4k', audio: true, labelKey: 'fourKReference' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo4K' },
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
