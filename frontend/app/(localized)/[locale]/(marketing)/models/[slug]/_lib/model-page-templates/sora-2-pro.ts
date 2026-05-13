import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const sora2ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'sora-2-pro',
  intent: 'production',
  hero: {
    eyebrow: 'OPENAI PRO VIDEO MODEL',
    subtitleHighlightTerms: ['higher-resolution finals', 'synced audio', 'reference-guided image-to-video'],
    primaryCtaHref: '/app?engine=sora-2-pro',
    secondaryCtaHref: '/examples/sora',
    quickLinks: [
      {
        labelKey: 'compareStandard',
        href: '/ai-video-engines/sora-2-vs-sora-2-pro?order=sora-2-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#sora-2-pro-pricing',
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
    anchorHref: '/pricing#sora-2-pro-pricing',
    presets: [
      { id: '4s-720p', seconds: 4, resolution: '720p', labelKey: 'entryDraft' },
      { id: '8s-1080p', seconds: 8, resolution: '1080p', labelKey: 'standardPreview' },
      {
        id: '12s-1080p',
        seconds: 12,
        resolution: '1080p',
        labelKey: 'finalDelivery',
        highlightKey: 'mostPopular',
      },
      { id: 'audio-included', fixedValueKey: 'audioExtraValue', labelKey: 'audio', noteKey: 'nativeAudioIncluded' },
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
