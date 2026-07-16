import type { AppLocale } from '@/i18n/locales';
import { enPayAsYouGoContent } from './en';
import { esPayAsYouGoContent } from './es';
import { frPayAsYouGoContent } from './fr';
import type { PayAsYouGoContent } from './types';

const CONTENT_BY_LOCALE: Record<AppLocale, PayAsYouGoContent> = {
  en: enPayAsYouGoContent,
  es: esPayAsYouGoContent,
  fr: frPayAsYouGoContent,
};

export function getPayAsYouGoContent(locale: AppLocale): PayAsYouGoContent {
  const content = CONTENT_BY_LOCALE[locale];
  if (!content) {
    throw new Error(`[payg-content] Missing complete Pay-as-you-go content for locale "${locale}".`);
  }
  return content;
}

export type { PayAsYouGoContent } from './types';
