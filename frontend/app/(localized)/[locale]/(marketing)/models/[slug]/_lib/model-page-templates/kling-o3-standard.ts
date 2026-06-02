import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const klingO3StandardTemplateConfig: ModelPageTemplateConfig = {
  slug: 'kling-o3-standard',
  intent: 'draft',
  hero: {
    eyebrow: 'KLING OMNI LOWER-COST REFERENCE ROUTE',
    subtitleHighlightTerms: ['reference images', 'storyboard drafts', 'source-video V2V'],
    primaryCtaHref: '/app?engine=kling-o3-standard',
    secondaryCtaHref: '/examples/kling',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/ai-video-engines/kling-o3-pro-vs-kling-o3-standard',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#kling-o3-standard-pricing',
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
    anchorHref: '/pricing#kling-o3-standard-pricing',
    presets: [
      { id: '5s-1080p', seconds: 5, resolution: '1080p', labelKey: 'entryDraft', noteKey: 'fiveSeconds1080pAudioOff' },
      { id: '8s-1080p-audio', seconds: 8, resolution: '1080p', audio: true, labelKey: 'storyboardPass', noteKey: 'eightSeconds1080pAudioOn' },
      {
        id: '15s-1080p-audio',
        seconds: 15,
        resolution: '1080p',
        audio: true,
        labelKey: 'commonProductionCheck',
        noteKey: 'fifteenSeconds1080pAudioOn',
        highlightKey: 'mostPopular',
      },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo1080p' },
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
