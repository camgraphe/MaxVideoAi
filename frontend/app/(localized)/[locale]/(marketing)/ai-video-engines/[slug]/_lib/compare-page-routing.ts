import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { canonicalizeFalModelSlug } from '@/config/falEngines';
import {
  CATALOG_BY_SLUG,
  COMPARE_SLUG_MAP,
  EXCLUDED_ENGINE_SLUGS,
  MODELS_SLUG_MAP,
} from './compare-page-config';

const LEGACY_COMPARE_REPLACEMENTS: Record<string, { slug: string; orderAliases: Record<string, string> }> = {
  'happy-horse-1-0-vs-sora-2-pro': {
    slug: 'happy-horse-1-1-vs-sora-2-pro',
    orderAliases: { 'happy-horse-1-0': 'happy-horse-1-1' },
  },
};

export function reverseCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  return `${parts[1]}-vs-${parts[0]}`;
}

export function resolveEngines(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const [leftSlug, rightSlug] = parts;
  if (EXCLUDED_ENGINE_SLUGS.has(leftSlug) || EXCLUDED_ENGINE_SLUGS.has(rightSlug)) {
    return null;
  }
  const left = CATALOG_BY_SLUG.get(leftSlug);
  const right = CATALOG_BY_SLUG.get(rightSlug);
  if (!left || !right) return null;
  return { left, right };
}

export function getCanonicalCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const [rawLeftSlug, rawRightSlug] = parts;
  const leftSlug = canonicalizeFalModelSlug(rawLeftSlug);
  const rightSlug = canonicalizeFalModelSlug(rawRightSlug);
  const sorted = [leftSlug, rightSlug].sort();
  return {
    canonicalSlug: `${sorted[0]}-vs-${sorted[1]}`,
    leftSlug,
    rightSlug,
  };
}

export function resolveExcludedCompareRedirect({
  slug,
  order,
  locale,
}: {
  slug: string;
  order?: string | null;
  locale: AppLocale;
}) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const excluded = parts.filter((part) => EXCLUDED_ENGINE_SLUGS.has(part));
  if (!excluded.length) return null;
  const preferred = order && excluded.includes(order) ? order : excluded[0];
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const modelsBase = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en ?? 'models';
  return `${localePrefix}/${modelsBase}/${preferred}`.replace(/\/{2,}/g, '/');
}

export function resolveLegacyCompareRedirect({ slug, order, locale }: {
  slug: string;
  order?: string | null;
  locale: AppLocale;
}) {
  const replacement = LEGACY_COMPARE_REPLACEMENTS[slug];
  if (!replacement) return null;
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const compareBase = COMPARE_SLUG_MAP[locale] ?? COMPARE_SLUG_MAP.en ?? 'ai-video-engines';
  const targetOrder = order ? replacement.orderAliases[order] ?? order : null;
  const query = targetOrder ? `?order=${encodeURIComponent(targetOrder)}` : '';
  return `${localePrefix}/${compareBase}/${replacement.slug}${query}`.replace(/\/{2,}/g, '/');
}

export function buildGenerateHref(engineSlug: string, prompt?: string | null, aspectRatio?: string | null, mode?: string | null) {
  const params = new URLSearchParams({ engine: engineSlug });
  if (prompt) {
    params.set('prompt', prompt);
  }
  if (aspectRatio) {
    params.set('ar', aspectRatio);
  }
  if (mode) {
    params.set('mode', mode);
  }
  return `/app?${params.toString()}`;
}
