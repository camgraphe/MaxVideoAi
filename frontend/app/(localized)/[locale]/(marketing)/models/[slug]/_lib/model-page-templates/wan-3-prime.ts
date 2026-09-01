import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const wan3PrimeTemplateConfig: ModelPageTemplateConfig = {
  slug: 'wan-3-prime',
  intent: 'production',
  hero: {
    eyebrow: 'CURRENT WAN PRIME ROUTE',
    subtitleHighlightTerms: ['premium Wan route', 'text, image, or reference inputs', 'up to 30 seconds'],
    primaryCtaHref: '/app?engine=wan-3-prime',
    secondaryCtaHref: '/examples/wan',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#wan-3-prime-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#wan-3-prime-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '6s-1080p-t2v', seconds: 6, resolution: '1080p', mode: 't2v', labelKey: 'deliveryRender' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
