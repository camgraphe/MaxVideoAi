import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx23ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-3-pro',
  intent: 'production',
  hero: {
    eyebrow: 'LTX PRODUCTION WORKFLOW ROUTE',
    subtitleHighlightTerms: ['audio-led workflows', 'Extend and Retake', '4K generate passes'],
    primaryCtaHref: '/app?engine=ltx-2-3',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#ltx-2-3-pro-pricing',
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
    anchorHref: '/pricing#ltx-2-3-pro-pricing',
    presets: [
      { id: '6s-1080p-audio', seconds: 6, resolution: '1080p', audio: true, labelKey: 'proWorkflow' },
      {
        id: '8s-1440p-audio',
        seconds: 8,
        resolution: '1440p',
        audio: true,
        labelKey: 'audioLedWorkflow',
        highlightKey: 'mostPopular',
      },
      { id: '10s-4k-audio', seconds: 10, resolution: '4k', audio: true, labelKey: 'fourKReference' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'generateModesOnly' },
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
