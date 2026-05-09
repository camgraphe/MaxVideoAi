import type { AppLocale } from '@/i18n/locales';
import { EN_BEST_FOR_CTA, EN_HUB_COPY } from './ai-video-engines-copy-en';
import { ES_BEST_FOR_CTA, ES_HUB_COPY } from './ai-video-engines-copy-es';
import { FR_BEST_FOR_CTA, FR_HUB_COPY } from './ai-video-engines-copy-fr';
import type { BestForCtaCopy, HubCopy } from './ai-video-engines-copy-types';

export type { BestForCtaCopy, HubCopy, HubFaqEntry } from './ai-video-engines-copy-types';

const HUB_COPY_BY_LOCALE: Record<AppLocale, HubCopy> = {
  en: EN_HUB_COPY,
  fr: FR_HUB_COPY,
  es: ES_HUB_COPY,
};

const BEST_FOR_CTA_BY_LOCALE: Record<AppLocale, BestForCtaCopy> = {
  en: EN_BEST_FOR_CTA,
  fr: FR_BEST_FOR_CTA,
  es: ES_BEST_FOR_CTA,
};

export function getHubCopy(locale: AppLocale): HubCopy {
  return HUB_COPY_BY_LOCALE[locale] ?? HUB_COPY_BY_LOCALE.en;
}

export function getBestForCta(locale: AppLocale): BestForCtaCopy {
  return BEST_FOR_CTA_BY_LOCALE[locale] ?? BEST_FOR_CTA_BY_LOCALE.en;
}
