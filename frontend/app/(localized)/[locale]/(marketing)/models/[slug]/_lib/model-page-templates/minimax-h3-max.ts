import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const minimaxH3MaxTemplateConfig: ModelPageTemplateConfig = {
  slug: 'minimax-h3-max',
  intent: 'production',
  hero: {
    eyebrow: 'H3 MAX FAST PRODUCTION ROUTE',
    subtitleHighlightTerms: ['5–15 seconds', 'up to 768P', 'native audio'],
    primaryCtaHref: '/app?engine=minimax-h3-max',
    secondaryCtaHref: '/examples/hailuo',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#minimax-h3-max-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#minimax-h3-max-pricing',
    presets: [
      { id: '8s-480P-t2v', seconds: 8, resolution: '480p', mode: 't2v', labelKey: 'standardPreview' },
      { id: '8s-768P-t2v', seconds: 8, resolution: '768P', mode: 't2v', labelKey: 'deliveryRender', highlightKey: 'mostPopular' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
