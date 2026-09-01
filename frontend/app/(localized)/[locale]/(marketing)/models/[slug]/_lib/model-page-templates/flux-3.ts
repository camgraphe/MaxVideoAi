import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const flux3TemplateConfig: ModelPageTemplateConfig = {
  slug: 'flux-3',
  intent: 'production',
  hero: {
    eyebrow: 'CURRENT FLUX VIDEO PRODUCTION ROUTE',
    subtitleHighlightTerms: ['text and image generation', 'first-and-last-frame control', 'video extension'],
    primaryCtaHref: '/app?engine=flux-3',
    secondaryCtaHref: '/examples/flux',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#flux-3-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#flux-3-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'standardPreview' },
      { id: '6s-1080p-t2v', seconds: 6, resolution: '1080p', mode: 't2v', labelKey: 'deliveryRender', highlightKey: 'mostPopular' },
      { id: '6s-720p-extend', seconds: 6, resolution: '720p', mode: 'extend', labelKey: 'storyboardPass' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
