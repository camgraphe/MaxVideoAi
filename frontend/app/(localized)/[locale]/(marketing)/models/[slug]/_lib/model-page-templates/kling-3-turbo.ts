import type { ModelPageTemplateConfig } from '../model-page-template-types';

function createKling3TurboTemplate(
  slug: 'kling-3-turbo-standard' | 'kling-3-turbo-pro',
  resolution: '720p' | '1080p',
): ModelPageTemplateConfig {
  return {
    slug,
    intent: 'production',
    hero: {
      eyebrow: resolution === '720p' ? 'KLING TURBO VALUE ROUTE' : 'KLING TURBO 1080P ROUTE',
      subtitleHighlightTerms: [resolution, '3–15 seconds', 'native audio'],
      primaryCtaHref: `/app?engine=${slug}`,
      secondaryCtaHref: '/examples/kling',
      quickLinks: [
        { labelKey: 'viewPricing', href: `/pricing#${slug}-pricing`, icon: 'pricing' },
        { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
      ],
    },
    pricing: {
      enabled: true,
      anchorHref: `/pricing#${slug}-pricing`,
      presets: [
        { id: `5s-${resolution}-t2v`, seconds: 5, resolution, mode: 't2v', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
        { id: `10s-${resolution}-t2v`, seconds: 10, resolution, mode: 't2v', labelKey: 'deliveryRender' },
      ],
    },
    sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true },
  };
}

export const kling3TurboStandardTemplateConfig = createKling3TurboTemplate('kling-3-turbo-standard', '720p');
export const kling3TurboProTemplateConfig = createKling3TurboTemplate('kling-3-turbo-pro', '1080p');
