import fs from 'node:fs';
import path from 'node:path';

import { locales, type AppLocale } from '@/i18n/locales';
import {
  BLOG_SLUG_MAP,
  CONTENT_ROOT,
  localizePathFromEnglish,
  normalizePathSegments,
  type SupportedLocale,
} from '@/lib/i18n/paths';

const BLOG_PATH_REGEX = /^\/blog\/([^/]+)\/?$/i;
const MODEL_PATH_REGEX = /^\/models\/([^/]+)\/?$/i;

export const HREFLANG_VARIANTS: Array<{ hreflang: string; locale: AppLocale }> = [
  { hreflang: 'en', locale: 'en' },
  { hreflang: 'fr', locale: 'fr' },
  { hreflang: 'es', locale: 'es' },
];

const modelLocaleCache = new Map<string, Set<AppLocale>>();

function toAppLocale(value: SupportedLocale): AppLocale {
  return value as AppLocale;
}

function readModelLocales(slug: string): Set<AppLocale> {
  if (modelLocaleCache.has(slug)) {
    return modelLocaleCache.get(slug)!;
  }
  const supported = new Set<AppLocale>(['en']);
  locales.forEach((locale) => {
    if (locale === 'en') {
      return;
    }
    const candidate = path.join(CONTENT_ROOT, 'models', locale, `${slug}.json`);
    const legacyCandidate = path.join(CONTENT_ROOT, locale, 'models', `${slug}.json`);
    if (fs.existsSync(candidate) || fs.existsSync(legacyCandidate)) {
      supported.add(locale);
    }
  });
  modelLocaleCache.set(slug, supported);
  return supported;
}

function readBlogLocales(slug: string): Set<AppLocale> {
  const entry = BLOG_SLUG_MAP.get(slug);
  if (!entry) {
    return new Set<AppLocale>(['en']);
  }
  const localesWithContent = new Set<AppLocale>(['en']);
  Object.keys(entry).forEach((locale) => {
    localesWithContent.add(toAppLocale(locale as SupportedLocale));
  });
  return localesWithContent;
}

function sanitizeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw.trim().toLowerCase());
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function resolveLocalesForEnglishPath(englishPath: string): Set<AppLocale> {
  const normalized = englishPath.trim() || '/';
  const blogMatch = BLOG_PATH_REGEX.exec(normalized);
  if (blogMatch && blogMatch[1]) {
    return new Set<AppLocale>(readBlogLocales(sanitizeSlug(blogMatch[1])));
  }
  const modelMatch = MODEL_PATH_REGEX.exec(normalized);
  if (modelMatch && modelMatch[1]) {
    return new Set<AppLocale>(readModelLocales(sanitizeSlug(modelMatch[1])));
  }
  return new Set<AppLocale>(locales);
}

export function buildAbsoluteLocalizedUrl(siteUrl: string, locale: AppLocale, englishPath: string): string {
  const localizedPath = localizePathFromEnglish(locale as SupportedLocale, englishPath);
  const normalizedPath =
    localizedPath === '/' ? '/' : normalizePathSegments(localizedPath.replace(/^\/+/, ''));
  if (normalizedPath === '/' || normalizedPath === '') {
    return siteUrl;
  }
  return `${siteUrl}${normalizedPath}`;
}
