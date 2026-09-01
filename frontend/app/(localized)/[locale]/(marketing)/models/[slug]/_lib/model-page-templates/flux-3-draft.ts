import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const flux3DraftTemplateConfig: ModelPageTemplateConfig = {
  slug: 'flux-3-draft',
  intent: 'draft',
  hero: {
    eyebrow: 'CURRENT FLUX VIDEO DRAFT ROUTE',
    subtitleHighlightTerms: ['720p iteration', 'first-and-last-frame drafts', 'draft video extension'],
    primaryCtaHref: '/app?engine=flux-3-draft',
    secondaryCtaHref: '/examples/flux',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#flux-3-draft-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#flux-3-draft-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'motionDraft', highlightKey: 'mostPopular' },
      { id: '6s-720p-extend', seconds: 6, resolution: '720p', mode: 'extend', labelKey: 'storyboardPass' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
