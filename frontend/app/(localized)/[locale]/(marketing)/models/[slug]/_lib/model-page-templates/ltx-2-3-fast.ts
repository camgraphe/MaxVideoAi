import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx23FastTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-3-fast',
  intent: 'draft',
  hero: {
    eyebrow: 'LTX FAST DRAFT ROUTE',
    subtitleHighlightTerms: ['visual exploration', 'prompt testing', 'vertical/social drafts'],
    primaryCtaHref: '/app?engine=ltx-2-3-fast',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#ltx-2-3-fast-pricing',
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
    anchorHref: '/pricing#ltx-2-3-fast-pricing',
    presets: [
      {
        id: '10s-1080p',
        seconds: 10,
        resolution: '1080p',
        labelKey: 'motionDraft',
        noteKey: 'tenSeconds1080pDraft',
        highlightKey: 'mostPopular',
      },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration' },
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
