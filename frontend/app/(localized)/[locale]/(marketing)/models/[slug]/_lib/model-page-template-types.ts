import type { AppLocale } from '@/i18n/locales';

export type ModelPageTemplateIntent = 'production' | 'draft' | 'reference-prep' | 'specialized';

export type ModelPageTemplateIcon =
  | 'app'
  | 'audio'
  | 'compare'
  | 'examples'
  | 'image'
  | 'pricing'
  | 'prompt'
  | 'speed'
  | 'video';

export type ModelPagePricingPreset = {
  id: string;
  seconds?: number;
  resolution?: '480p' | '720p' | '1080p';
  labelKey: string;
  noteKey?: string;
  highlightKey?: string;
  fixedValueKey?: 'audioExtraValue' | 'maxDurationValue';
};

export type ModelPageTemplateQuickLink = {
  labelKey: string;
  href: string;
  icon: ModelPageTemplateIcon;
};

export type ModelPageTemplateConfig = {
  slug: string;
  intent: ModelPageTemplateIntent;
  hero: {
    eyebrow: string;
    subtitleHighlightTerms: string[];
    primaryCtaHref: string;
    secondaryCtaHref: string;
    quickLinks: ModelPageTemplateQuickLink[];
  };
  pricing: {
    anchorHref: string;
    presets: ModelPagePricingPreset[];
  };
  sections: {
    examples: boolean;
    prompting: boolean;
    tips: boolean;
    compare: boolean;
    specs: boolean;
    safety: boolean;
    faq: boolean;
  };
};

export type LocalizedModelTemplateConfig = ModelPageTemplateConfig & {
  locale: AppLocale;
};
