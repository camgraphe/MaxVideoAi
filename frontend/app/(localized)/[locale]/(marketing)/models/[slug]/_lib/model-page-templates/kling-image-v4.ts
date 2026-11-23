import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingImageV4TemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-image-v4',
  intent: 'production',
  hero: {
    eyebrow: 'KLING IMAGE 4.0',
    subtitleHighlightTerms: ['8K', 'Image Sets'],
    primaryCtaHref: '/app/image?engine=kling-image-v4',
    secondaryCtaHref: '#specs',
    quickLinks: [{ labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' }],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#kling-image-v4-pricing',
    presets: [
      { id: '2k-image', imageResolution: '2K', mode: 't2i', labelKey: 'twoKImage', noteKey: 'singleGeneratedStill' },
      { id: '4k-image', imageResolution: '4K', mode: 't2i', labelKey: 'fourKImage', noteKey: 'singleGeneratedStill' },
      { id: '8k-image', imageResolution: '8K', mode: 't2i', labelKey: 'eightKImage', noteKey: 'singleGeneratedStill' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: false, specs: true, safety: true, faq: true },
};
