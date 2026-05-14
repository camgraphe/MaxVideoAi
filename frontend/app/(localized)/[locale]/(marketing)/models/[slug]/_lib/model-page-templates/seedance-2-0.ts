import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance20TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-0',
  intent: 'production',
  hero: {
    eyebrow: 'BYTEDANCE CURRENT-GEN MODEL',
    subtitleHighlightTerms: ['Native audio', 'multi-shot continuity', 'reference-guided video'],
    primaryCtaHref: '/app?engine=seedance-2-0',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#seedance-2-0-pricing',
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
    anchorHref: '/pricing#seedance-2-0-pricing',
    presets: [
      { id: '5s-480p', seconds: 5, resolution: '480p', labelKey: 'entryDraft', noteKey: 'fiveSeconds480p' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview', noteKey: 'eightSeconds720p' },
      {
        id: '10s-1080p',
        seconds: 10,
        resolution: '1080p',
        labelKey: 'commonProductionCheck',
        noteKey: 'tenSeconds1080p',
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
