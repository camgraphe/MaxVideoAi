import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingO3ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-o3-pro',
  intent: 'production',
  hero: {
    eyebrow: 'KLING OMNI PRO REFERENCE ROUTE',
    subtitleHighlightTerms: ['reference-to-video', 'storyboard guidance', 'video-to-video'],
    primaryCtaHref: '/app?engine=kling-o3-pro',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'compareV3',
        href: '/ai-video-engines/kling-3-pro-vs-kling-o3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-o3-pro-pricing',
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
    anchorHref: '/pricing#kling-o3-pro-pricing',
    presets: [
      { id: '5s-1080p-audio', seconds: 5, resolution: '1080p', audio: true, labelKey: 'storyboardPass', noteKey: 'fiveSeconds1080pAudioOn' },
      {
        id: '10s-1080p-audio',
        seconds: 10,
        resolution: '1080p',
        audio: true,
        labelKey: 'commonProductionCheck',
        noteKey: 'tenSeconds1080pAudioOn',
        highlightKey: 'mostPopular',
      },
      { id: '15s-1080p-audio', seconds: 15, resolution: '1080p', audio: true, labelKey: 'nativeAudioShot', noteKey: 'fifteenSeconds1080pAudioOn' },
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
