import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx2FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'SUPPORTED LTX 2 FAST ROUTE',
    subtitleHighlightTerms: ['fast 16:9 drafts', 'up to 20s', '1080p to 4K checks'],
    primaryCtaHref: '/app?engine=ltx-2-fast',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      {
        labelKey: 'compareFast',
        href: '/models/ltx-2-3-fast',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#ltx-2-fast-pricing',
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
    anchorHref: '/pricing#ltx-2-fast-pricing',
    presets: [
      { id: '6s-1080p-audio', seconds: 6, resolution: '1080p', audio: true, labelKey: 'entryDraft' },
      { id: '10s-1080p-audio', seconds: 10, resolution: '1080p', audio: true, labelKey: 'standardPreview' },
      {
        id: '20s-1080p-audio',
        seconds: 20,
        resolution: '1080p',
        audio: true,
        labelKey: 'commonProductionCheck',
        highlightKey: 'mostPopular',
      },
      { id: '10s-4k-audio', seconds: 10, resolution: '4k', audio: true, labelKey: 'fourKReference' },
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
