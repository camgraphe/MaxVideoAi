import type { AppLocale } from '@/i18n/locales';

export type ComparePageOverride = {
  meta?: {
    title?: string;
    description?: string;
    titleBranding?: 'auto' | 'none';
  };
  heroIntro?: string;
  quickVerdict?: {
    title: string;
    body: string;
  };
  topCards?: Array<{
    title: string;
    body: string;
  }>;
  primaryLinksTitle?: string;
  primaryLinks?: Array<{
    href: string;
    label: string;
  }>;
  faq?: {
    title?: string;
    subtitle?: string;
    items: Array<{
      question: string;
      answer: string | string[];
    }>;
  };
};

export type ComparePageContentDocument = {
  slug: string;
  en: ComparePageOverride;
  fr: ComparePageOverride;
  es: ComparePageOverride;
};

export type ComparePageOverridesBySlug = Record<string, ComparePageOverride>;
export type ComparePageOverridesByLocale = Partial<Record<AppLocale, ComparePageOverridesBySlug>>;
