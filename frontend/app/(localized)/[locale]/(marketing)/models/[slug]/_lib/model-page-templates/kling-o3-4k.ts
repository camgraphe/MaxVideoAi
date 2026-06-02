import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingO34kTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-o3-4k',
  intent: 'production',
  hero: {
    eyebrow: 'KLING OMNI NATIVE 4K REFERENCE ROUTE',
    subtitleHighlightTerms: ['native 4K', 'reference images', 'storyboard delivery'],
    primaryCtaHref: '/app?engine=kling-o3-4k',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/kling-o3-4k-vs-kling-o3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-o3-4k-pricing',
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
    anchorHref: '/pricing#kling-o3-4k-pricing',
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
