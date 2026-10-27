import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const nanoBanana21TemplateConfig: ModelPageTemplateConfig = {
  slug: 'nano-banana-2-1',
  intent: 'production',
  hero: {
    eyebrow: 'GOOGLE IMAGE MODEL',
    subtitleHighlightTerms: [],
    primaryCtaHref: '/app/image?engine=nano-banana-2-1',
    secondaryCtaHref: '#examples',
    quickLinks: [],
  },
  pricing: {
    enabled: true,
    anchorHref: '#pricing',
    presets: [
      { id:'1k-image',imageResolution:'1k',labelKey:'standardPreview' },
      { id:'2k-image',imageResolution:'2k',labelKey:'twoKStill' },
      { id:'4k-image',imageResolution:'4k',labelKey:'fourKStill' },
    ],
  },
  sections: { examples:true,prompting:false,tips:true,compare:false,specs:true,safety:false,faq:false },
};
