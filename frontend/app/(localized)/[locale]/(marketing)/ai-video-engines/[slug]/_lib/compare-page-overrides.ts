import type { AppLocale } from '@/i18n/locales';
import { EN_COMPARE_PAGE_OVERRIDES } from './compare-page-overrides-en';
import { ES_COMPARE_PAGE_OVERRIDES } from './compare-page-overrides-es';
import { FR_COMPARE_PAGE_OVERRIDES } from './compare-page-overrides-fr';
import type { ComparePageOverride, ComparePageOverridesByLocale } from './compare-page-overrides-types';
export type { ComparePageOverride } from './compare-page-overrides-types';

const COMPARE_PAGE_OVERRIDES: ComparePageOverridesByLocale = {
  en: EN_COMPARE_PAGE_OVERRIDES,
  fr: FR_COMPARE_PAGE_OVERRIDES,
  es: ES_COMPARE_PAGE_OVERRIDES,
};

export function getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined {
  return COMPARE_PAGE_OVERRIDES[locale]?.[slug];
}
