import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const geminiOmniFlashTemplateConfig: ModelPageTemplateConfig = {
  slug: 'gemini-omni-flash',
  intent: 'specialized',
  hero: {
    eyebrow: 'GOOGLE GEMINI OMNI VIDEO PREVIEW',
    subtitleHighlightTerms: ['stateful video editing', 'up to 10s', 'native sound direction'],
    primaryCtaHref: '/app?engine=gemini-omni-flash',
    secondaryCtaHref: '/ai-video-engines/gemini-omni-flash-vs-veo-3-1',
    quickLinks: [
      {
        labelKey: 'compareVeo',
        href: '/ai-video-engines/gemini-omni-flash-vs-veo-3-1',
        icon: 'compare',
      },
      { labelKey: 'viewPricing', href: '/pricing#gemini-omni-flash-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
      { labelKey: 'modelSpecs', href: '#specs', icon: 'video' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#gemini-omni-flash-pricing',
    presets: [
      { id: '4s-720p-audio', seconds: 4, resolution: '720p', audio: true, labelKey: 'motionDraft' },
      {
        id: '8s-720p-audio',
        seconds: 8,
        resolution: '720p',
        audio: true,
        labelKey: 'standardPreview',
        highlightKey: 'mostPopular',
      },
      { id: '10s-720p-audio', seconds: 10, resolution: '720p', audio: true, labelKey: 'deliveryRender' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo720p' },
    ],
  },
  sections: {
    examples: false,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
