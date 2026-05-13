import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const sora2TemplateConfig: ModelPageTemplateConfig = {
  slug: 'sora-2',
  intent: 'draft',
  hero: {
    eyebrow: 'OPENAI FLAGSHIP VIDEO MODEL',
    subtitleHighlightTerms: ['synced audio', 'text-to-video', 'image-to-video'],
    primaryCtaHref: '/app?engine=sora-2',
    secondaryCtaHref: '/examples/sora',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/sora-2-vs-sora-2-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#sora-2-pricing',
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
    anchorHref: '/pricing#sora-2-pricing',
    presets: [
      { id: '4s-720p', seconds: 4, resolution: '720p', labelKey: 'entryDraft' },
      { id: '8s-720p', seconds: 8, resolution: '720p', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '12s-720p', seconds: 12, resolution: '720p', labelKey: 'storyboardPass' },
      { id: 'audio-included', fixedValueKey: 'audioExtraValue', labelKey: 'audio', noteKey: 'nativeAudioIncluded' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo720p' },
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
