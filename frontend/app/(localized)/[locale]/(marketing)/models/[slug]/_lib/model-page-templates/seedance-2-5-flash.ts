import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const seedance25FlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'seedance-2-5-flash',
  intent: 'production',
  hero: {
    eyebrow: 'ByteDance · 480p / 720p · Up to 30 seconds',
    subtitleHighlightTerms: [],
    primaryCtaHref: '/app?engine=seedance-2-5-flash',
    secondaryCtaHref: '/ai-video-engines/seedance-2-5-vs-seedance-2-5-flash',
    quickLinks: [
      { labelKey: 'compareCurrent', href: '/ai-video-engines/seedance-2-5-vs-seedance-2-5-flash?order=seedance-2-5-flash', icon: 'compare' },
      { labelKey: 'viewPricing', href: '#pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    showScenarioDetails: true,
    anchorHref: '#pricing',
    presets: [
      { id: '4s-480p', seconds: 4, resolution: '480p', labelKey: 'entryDraft' },
      { id: '8s-720p-audio', seconds: 8, resolution: '720p', audio: true, labelKey: 'commonProductionCheck' },
      { id: '30s-720p', seconds: 30, resolution: '720p', labelKey: 'storyboardPass' },
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
