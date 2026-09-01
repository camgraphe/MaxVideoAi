import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const grokImagineVideo15TemplateConfig: ModelPageTemplateConfig = {
  slug: 'grok-imagine-video-1-5',
  intent: 'production',
  hero: {
    eyebrow: 'CURRENT GROK VIDEO ROUTE',
    subtitleHighlightTerms: ['text, image, or image references', '1 to 15 seconds', '480p to 1080p'],
    primaryCtaHref: '/app?engine=grok-imagine-video-1-5',
    secondaryCtaHref: '/examples/grok',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#grok-imagine-video-1-5-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#grok-imagine-video-1-5-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '6s-1080p-t2v', seconds: 6, resolution: '1080p', mode: 't2v', labelKey: 'deliveryRender' },
      { id: '8s-480p-ref2v-2-images', seconds: 8, resolution: '480p', mode: 'ref2v', referenceImageCount: 2, labelKey: 'referenceBatch' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
