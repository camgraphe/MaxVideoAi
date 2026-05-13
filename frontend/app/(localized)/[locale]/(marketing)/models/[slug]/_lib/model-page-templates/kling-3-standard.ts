import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const kling3StandardTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-3-standard',
  intent: 'draft',
  hero: {
    eyebrow: 'KLING LOWER-COST STORYBOARD ROUTE',
    subtitleHighlightTerms: ['multi-shot drafts', '1080p storyboard tests', 'native audio options'],
    primaryCtaHref: '/app?engine=kling-3-standard',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/kling-3-pro-vs-kling-3-standard',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-3-standard-pricing',
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
    anchorHref: '/pricing#kling-3-standard-pricing',
    presets: [
      { id: '5s-1080p', seconds: 5, resolution: '1080p', labelKey: 'entryDraft' },
      { id: '8s-1080p-audio', seconds: 8, resolution: '1080p', audio: true, labelKey: 'storyboardPass' },
      {
        id: '15s-1080p-audio',
        seconds: 15,
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
