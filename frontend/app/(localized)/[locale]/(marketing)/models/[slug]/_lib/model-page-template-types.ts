import type { AppLocale } from '@/i18n/locales';
import type { Resolution } from '@/types/engines';

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

type BaseModelPagePricingPreset = {
  id: string;
  labelKey: string;
  noteKey?: string;
  highlightKey?: string;
};

export type ModelPageVideoPricingPreset = BaseModelPagePricingPreset & {
  seconds: number;
  resolution: Extract<Resolution, '480p' | '720p' | '1080p' | '1440p' | '4k'>;
  audio?: boolean;
  fixedValueKey?: never;
  imageResolution?: never;
};

export type ModelPageFixedPricingPreset = BaseModelPagePricingPreset & {
  fixedValueKey: 'audioExtraValue' | 'maxDurationValue';
  seconds?: never;
  resolution?: never;
  audio?: never;
  imageResolution?: never;
};

export type ModelPageImagePricingPreset = BaseModelPagePricingPreset & {
  imageResolution: string;
  imageQuality?: 'medium' | 'high';
  quantity?: number;
  fixedValueKey?: never;
  seconds?: never;
  resolution?: never;
  audio?: never;
};

export type ModelPagePricingPreset =
  | ModelPageVideoPricingPreset
  | ModelPageFixedPricingPreset
  | ModelPageImagePricingPreset;

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
