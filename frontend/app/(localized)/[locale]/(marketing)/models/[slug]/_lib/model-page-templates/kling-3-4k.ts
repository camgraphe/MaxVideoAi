import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const kling34kTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-3-4k',
  intent: 'production',
  hero: {
    eyebrow: 'KLING NATIVE 4K DELIVERY ROUTE',
    subtitleHighlightTerms: ['native 4K delivery', 'approved image-to-video shots', 'final campaign masters'],
    primaryCtaHref: '/app?engine=kling-3-4k',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/kling-3-4k-vs-kling-3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-3-4k-pricing',
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
    anchorHref: '/pricing#kling-3-4k-pricing',
    presets: [
      { id: '5s-4k', seconds: 5, resolution: '4k', audio: true, labelKey: 'fourKReference' },
      {
        id: '10s-4k',
        seconds: 10,
        resolution: '4k',
        audio: true,
        labelKey: 'deliveryRender',
        highlightKey: 'mostPopular',
      },
      { id: '15s-4k', seconds: 15, resolution: '4k', audio: true, labelKey: 'finalDelivery' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'native4K' },
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
