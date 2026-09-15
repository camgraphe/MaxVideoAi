import type { ModelPageTemplateConfig } from '../model-page-template-types';

function buildGptImage25Template(variant: 'flare' | 'sunburst'): ModelPageTemplateConfig {
  const slug = `gpt-image-2-5-${variant}`;
  const label = variant === 'flare' ? 'FLARE' : 'SUNBURST';
  return {
    slug,
    intent: 'specialized',
    hero: {
      eyebrow: `OPENAI GPT IMAGE 2.5 ${label}`,
      subtitleHighlightTerms: variant === 'flare'
        ? ['fast generation', 'readable text', 'controlled edits']
        : ['maximum detail', 'precision editing', 'visual fidelity'],
      primaryCtaHref: `/app/image?engine=${slug}`,
      secondaryCtaHref: `/pricing#${slug}-pricing`,
      quickLinks: [
        { labelKey: 'openImageWorkspace', href: `/app/image?engine=${slug}`, icon: 'image' },
        { labelKey: 'viewPricing', href: `/pricing#${slug}-pricing`, icon: 'pricing' },
        { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
      ],
    },
    pricing: {
      anchorHref: `/pricing#${slug}-pricing`,
      presets: [
        {
          id: '1024x768-high', imageResolution: '1024x768', imageQuality: 'high',
          labelKey: 'productStill', noteKey: 'highResolutionStill',
        },
        {
          id: '3840x2160-high', imageResolution: '3840x2160', imageQuality: 'high',
          labelKey: 'fourKHeroStill', noteKey: 'highResolutionStill', highlightKey: 'mostPopular',
        },
        {
          id: '4x-1024x768-medium', imageResolution: '1024x768', imageQuality: 'medium', quantity: 4,
          labelKey: 'mediumVariantSet', noteKey: 'checkLiveQuote',
        },
      ],
    },
    sections: {
      examples: true,
      prompting: true,
      tips: true,
      compare: false,
      specs: true,
      safety: true,
      faq: true,
    },
  };
}

export const gptImage25FlareTemplateConfig = buildGptImage25Template('flare');
export const gptImage25SunburstTemplateConfig = buildGptImage25Template('sunburst');
