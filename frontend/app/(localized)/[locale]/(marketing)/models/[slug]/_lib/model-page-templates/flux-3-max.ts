import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const flux3MaxTemplateConfig: ModelPageTemplateConfig = {
  slug: 'flux-3-max',
  intent: 'production',
  comparisonLimit: 1,
  hero: {
    eyebrow: 'FLUX VIDEO WITH TEXT AND FRAME CONTROL',
    subtitleHighlightTerms: ['text or images', '5–20 second videos', 'optional audio'],
    primaryCtaHref: '/app?engine=flux-3-max',
    secondaryCtaHref: '/examples/flux',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#flux-3-max-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#flux-3-max-pricing',
    presets: [
      { id: '5s-720p-t2v', seconds: 5, resolution: '720p', audio: true, mode: 't2v', labelKey: 'standardPreview' },
      { id: '5s-1080p-t2v', seconds: 5, resolution: '1080p', audio: true, mode: 't2v', labelKey: 'deliveryRender' },
      { id: '10s-720p-t2v', seconds: 10, resolution: '720p', audio: true, mode: 't2v', labelKey: 'commonProductionCheck', highlightKey: 'mostPopular' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
