import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx25FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-5-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'CURRENT LTX FAST ITERATION ROUTE',
    subtitleHighlightTerms: ['fast iteration', 'text, image, or source audio', '720p through 4K'],
    primaryCtaHref: '/app?engine=ltx-2-5-fast',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#ltx-2-5-fast-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#ltx-2-5-fast-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'motionDraft', highlightKey: 'mostPopular' },
      { id: '6s-4k-t2v', seconds: 6, resolution: '4k', mode: 't2v', labelKey: 'fourKReference' },
      { id: '6s-1080p-a2v', seconds: 6, resolution: '1080p', mode: 'a2v', audio: true, labelKey: 'audioLedWorkflow' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
