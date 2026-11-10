import type { AppLocale } from '@/i18n/locales';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import type { OpenArtCopy } from './types';

const copyByLocale: Record<AppLocale, OpenArtCopy> = { en, fr, es };

export function getOpenArtCopy(locale: AppLocale): OpenArtCopy {
  return copyByLocale[locale];
}
