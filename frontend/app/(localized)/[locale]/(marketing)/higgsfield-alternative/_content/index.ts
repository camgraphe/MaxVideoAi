import type { AppLocale } from '@/i18n/locales';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
export function getComparisonCopy(locale: AppLocale) { return { en, fr, es }[locale]; }
