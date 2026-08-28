import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance25TemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-5',
  intent: 'production',
  hero: {
    eyebrow: 'New · Up to 30 seconds · 1080p · Native audio',
    subtitleHighlightTerms: ['4–30-second videos', 'multimodal references', 'optional generated audio'],
    primaryCtaHref: '/app?engine=seedance-2-5',
    secondaryCtaHref: '/examples/seedance',
    quickLinks: [
      {
        labelKey: 'compareCurrent',
        href: '/ai-video-engines/seedance-2-0-vs-seedance-2-5?order=seedance-2-5',
        icon: 'compare',
      },
      { labelKey: 'viewPricing', href: '#pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '#pricing',
    presets: [
      { id: '4s-480p', seconds: 4, resolution: '480p', labelKey: 'entryDraft' },
      {
        id: '15s-720p-audio',
        seconds: 15,
        resolution: '720p',
        audio: true,
        labelKey: 'commonProductionCheck',
        highlightKey: 'mostPopular',
      },
      { id: '24s-1080p', seconds: 24, resolution: '1080p', labelKey: 'storyboardPass' },
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
