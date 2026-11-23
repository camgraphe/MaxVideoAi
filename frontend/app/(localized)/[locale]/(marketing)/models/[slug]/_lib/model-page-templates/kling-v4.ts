import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingV4TemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-v4', intent: 'production',
  hero: {
    eyebrow: 'KLING 4.0', subtitleHighlightTerms: ['3–30 seconds', 'native audio', 'references'],
    primaryCtaHref: '/app?engine=kling-v4', secondaryCtaHref: '#specs',
    quickLinks: [{ labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' }],
  },
  pricing: {
    enabled: true,
    anchorHref: '/pricing#kling-v4-pricing',
    showScenarioDetails: true,
    presets: [
      { id: '5s-720p', seconds: 5, resolution: '720p', mode: 't2v', audio: true, labelKey: 'textToVideoSample' },
      { id: '5s-1080p', seconds: 5, resolution: '1080p', mode: 't2v', audio: true, labelKey: 'textToVideoSample' },
      { id: '5s-4k', seconds: 5, resolution: '4k', mode: 't2v', audio: true, labelKey: 'textToVideoSample' },
    ],
  },
  comparisonLimit: 2,
  sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
};
