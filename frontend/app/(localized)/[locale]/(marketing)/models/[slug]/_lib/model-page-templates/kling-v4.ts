import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingV4TemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-v4', intent: 'production',
  hero: {
    eyebrow: 'KLING 4.0', subtitleHighlightTerms: ['3–30 seconds', 'native audio', 'references'],
    primaryCtaHref: '#prompting', secondaryCtaHref: '#specs',
    quickLinks: [{ labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' }],
  },
  pricing: { enabled: false, anchorHref: '#specs', presets: [] },
  sections: { examples: true, prompting: true, tips: true, compare: false, specs: true, safety: true, faq: true },
};
