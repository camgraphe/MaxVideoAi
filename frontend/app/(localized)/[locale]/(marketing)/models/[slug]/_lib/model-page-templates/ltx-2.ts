import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const ltx2TemplateConfig: ModelPageTemplateConfig = {
  slug: 'ltx-2',
  intent: 'specialized',
  hero: {
    eyebrow: 'SUPPORTED LTX 2 PRO ROUTE',
    subtitleHighlightTerms: ['high-fidelity 16:9 clips', 'text-to-video or image-to-video', '1080p to 4K checks'],
    primaryCtaHref: '/app?engine=ltx-2',
    secondaryCtaHref: '/examples/ltx',
    quickLinks: [
      {
        labelKey: 'comparePro',
        href: '/models/ltx-2-3-pro',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#ltx-2-pricing',
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
    anchorHref: '/pricing#ltx-2-pricing',
    presets: [
      { id: '6s-1080p-audio', seconds: 6, resolution: '1080p', audio: true, labelKey: 'entryDraft' },
      {
        id: '8s-1440p-audio',
        seconds: 8,
        resolution: '1440p',
        audio: true,
        labelKey: 'standardPreview',
        highlightKey: 'mostPopular',
      },
      { id: '10s-4k-audio', seconds: 10, resolution: '4k', audio: true, labelKey: 'fourKReference' },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo4K' },
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
