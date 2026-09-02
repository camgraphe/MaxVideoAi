import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx25ProTemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2-5-pro',
  intent: 'production',
  hero: {
    eyebrow: 'CURRENT LTX PRODUCTION DEFAULT',
    subtitleHighlightTerms: ['production-focused output', 'text, image, or source audio', '720p or 1080p'],
    primaryCtaHref: '/app?engine=ltx-2-5-pro',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#ltx-2-5-pro-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
    ],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#ltx-2-5-pro-pricing',
    presets: [
      { id: '6s-720p-t2v', seconds: 6, resolution: '720p', mode: 't2v', labelKey: 'standardPreview' },
      { id: '6s-1080p-t2v', seconds: 6, resolution: '1080p', mode: 't2v', labelKey: 'proWorkflow', highlightKey: 'mostPopular' },
      { id: '6s-1080p-a2v', seconds: 6, resolution: '1080p', mode: 'a2v', audio: true, labelKey: 'audioLedWorkflow' },
    ],
  },
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
