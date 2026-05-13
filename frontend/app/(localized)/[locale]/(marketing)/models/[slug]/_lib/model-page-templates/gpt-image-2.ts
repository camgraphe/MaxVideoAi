import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const gptImage2TemplateConfig: ModelPageTemplateConfig = {
  slug: 'gpt-image-2',
  intent: 'specialized',
  hero: {
    eyebrow: 'OPENAI IMAGE GENERATION MODEL',
    subtitleHighlightTerms: ['readable text', 'product stills', 'controlled edits'],
    primaryCtaHref: '/app/image?engine=gpt-image-2',
    secondaryCtaHref: '/examples?engine=gpt-image-2',
    quickLinks: [
      { labelKey: 'openImageWorkspace', href: '/app/image?engine=gpt-image-2', icon: 'image' },
      { labelKey: 'viewPricing', href: '/pricing#gpt-image-2-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#gpt-image-2-pricing',
    presets: [
      { id: '1024x768-high', imageResolution: '1024x768', imageQuality: 'high', labelKey: 'stillImage' },
      {
        id: '3840x2160-high',
        imageResolution: '3840x2160',
        imageQuality: 'high',
        labelKey: 'fourKReference',
        highlightKey: 'mostPopular',
      },
      { id: '4x-1024x768-medium', imageResolution: '1024x768', imageQuality: 'medium', quantity: 4, labelKey: 'imageBatch' },
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
