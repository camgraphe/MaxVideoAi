import fs from 'node:fs';
import path from 'node:path';
import type { AppLocale } from '@/i18n/locales';
import { BLOG_SLUG_MAP, CONTENT_ROOT } from '@/lib/i18n/paths';

export const MODEL_CONTENT_ROOT = path.join(CONTENT_ROOT, 'models');

export function hasModelLocale(slug: string, locale: AppLocale): boolean {
  if (locale === 'en') {
    return true;
  }
  const candidate = path.join(MODEL_CONTENT_ROOT, locale, `${slug}.json`);
  return fs.existsSync(candidate);
}

export function hasBlogLocale(canonicalSlug: string, locale: AppLocale): boolean {
  if (locale === 'en') {
    return true;
  }
  const mapping = BLOG_SLUG_MAP.get(canonicalSlug);
  return Boolean(mapping?.[locale]);
}
