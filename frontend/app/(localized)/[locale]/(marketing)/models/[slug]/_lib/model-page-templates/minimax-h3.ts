import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const minimaxH3TemplateConfig: ModelPageTemplateConfig = {
  slug: 'minimax-h3',
  intent: 'production',
  hero: {
    eyebrow: 'New · 5–15 seconds · Up to 4K · Native stereo audio',
    subtitleHighlightTerms: ['5–15-second videos', 'up to 4K', 'native stereo audio'],
    primaryCtaHref: '/app?engine=minimax-h3',
    secondaryCtaHref: '/examples/minimax-h3',
    quickLinks: [
      {
        labelKey: 'compareKlingO3Pro',
        href: '/ai-video-engines/kling-o3-pro-vs-minimax-h3?order=minimax-h3',
        icon: 'compare',
      },
      { labelKey: 'viewPricing', href: '#pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '#pricing',
    presets: [
      { id: '5s-768p-text', seconds: 5, resolution: '768P', mode: 't2v', labelKey: 'entryText' },
      {
        id: '10s-2k-image',
        seconds: 10,
        resolution: '2K',
        mode: 'i2v',
        labelKey: 'imageProduction',
        highlightKey: 'mostPopular',
      },
      { id: '15s-4k-reference', seconds: 15, resolution: '4K', mode: 'ref2v', labelKey: 'referenceFinal' },
      {
        id: '9-reference-images',
        seconds: 10,
        resolution: '2K',
        mode: 'ref2v',
        referenceImageCount: 9,
        labelKey: 'fullImageReferenceSet',
      },
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
